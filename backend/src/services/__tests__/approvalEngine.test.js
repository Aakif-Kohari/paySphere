const approvalEngine = require('../approvalEngine');
const { approveStage, rejectStage, saveApprovalWorkflow } = require('../../controllers/payrollApproval.controller');
const ApprovalWorkflow = require('../../models/approvalWorkflow.model');
const WorkflowInstance = require('../../models/workflowInstance.model');
const PayrollUpdate = require('../../models/payroll.model');
const { resolveRole } = require('../../middlewares/rbac.middleware');

// Mock models and RBAC
jest.mock('../../models/approvalWorkflow.model', () => {
  const mockFindOne = jest.fn();
  const mockUpdateMany = jest.fn();
  const mockCreate = jest.fn();
  return {
    findOne: mockFindOne,
    updateMany: mockUpdateMany,
    create: mockCreate,
  };
});

jest.mock('../../models/workflowInstance.model', () => {
  const mockFindById = jest.fn();
  const mockFindOne = jest.fn();
  const mockFindOneAndUpdate = jest.fn();
  return {
    findById: mockFindById,
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
  };
});

jest.mock('../../models/payroll.model', () => {
  const mockFindById = jest.fn();
  const mockUpdateMany = jest.fn();
  return {
    findById: mockFindById,
    updateMany: mockUpdateMany,
  };
});

jest.mock('../../middlewares/rbac.middleware', () => ({
  resolveRole: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Dynamic Payroll Approval Workflow Engine (#1243)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getWorkflowForTenant should return custom sequence if active', async () => {
    const mockWorkflow = { name: 'Custom Workflow', sequence: ['HR', 'CFO'] };
    ApprovalWorkflow.findOne.mockResolvedValueOnce(mockWorkflow);

    const result = await approvalEngine.getWorkflowForTenant('tenant123');

    expect(result.sequence).toEqual(['HR', 'CFO']);
    expect(ApprovalWorkflow.findOne).toHaveBeenCalledWith({ tenantId: 'tenant123', isActive: true });
  });

  test('getWorkflowForTenant should return default sequence if none configured', async () => {
    ApprovalWorkflow.findOne.mockResolvedValueOnce(null);

    const result = await approvalEngine.getWorkflowForTenant('tenant123');

    expect(result.sequence).toEqual(['HR', 'Finance', 'CFO']);
  });

  test('processStageApproval should reject action if user role does not match current node', async () => {
    const mockInstance = {
      _id: 'inst123',
      tenantId: 'tenant123',
      currentNodeId: 'HR',
      __v: 1,
    };
    WorkflowInstance.findById.mockResolvedValueOnce(mockInstance);

    // Actor has 'Finance' role, but current node is 'HR'
    resolveRole.mockResolvedValueOnce({ role: { name: 'Finance' } });

    await expect(approvalEngine.processStageApproval({
      instanceId: 'inst123',
      actorId: 'user123',
      action: 'approve',
      expectedVersion: 1,
    })).rejects.toThrow(/requires approval from the HR role/);
  });

  test('processStageApproval should advance state to next sequence role upon approval', async () => {
    const mockInstance = {
      _id: 'inst123',
      tenantId: 'tenant123',
      currentNodeId: 'HR',
      targetEntityId: 'payroll123',
      __v: 1,
    };
    WorkflowInstance.findById.mockResolvedValueOnce(mockInstance);
    PayrollUpdate.findById.mockResolvedValueOnce({ month: 8, year: 2026 });
    resolveRole.mockResolvedValueOnce({ role: { name: 'HR' } });

    ApprovalWorkflow.findOne.mockResolvedValueOnce({
      sequence: ['HR', 'Finance', 'CFO']
    });

    WorkflowInstance.findOneAndUpdate.mockResolvedValueOnce({
      currentNodeId: 'Finance',
      status: 'in_progress',
    });

    const updated = await approvalEngine.processStageApproval({
      instanceId: 'inst123',
      actorId: 'user123',
      action: 'approve',
      expectedVersion: 1,
    });

    expect(WorkflowInstance.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'inst123', __v: 1 },
      expect.objectContaining({
        $set: { currentNodeId: 'Finance', status: 'in_progress' }
      }),
      { new: true }
    );
    expect(updated.status).toBe('in_progress');
  });

  test('processStageApproval should mark payroll approved when final sequence role approves', async () => {
    const mockInstance = {
      _id: 'inst123',
      tenantId: 'tenant123',
      currentNodeId: 'CFO',
      targetEntityId: 'payroll123',
      __v: 1,
    };
    WorkflowInstance.findById.mockResolvedValueOnce(mockInstance);
    PayrollUpdate.findById.mockResolvedValueOnce({ month: 8, year: 2026 });
    resolveRole.mockResolvedValueOnce({ role: { name: 'CFO' } });

    ApprovalWorkflow.findOne.mockResolvedValueOnce({
      sequence: ['HR', 'Finance', 'CFO']
    });

    WorkflowInstance.findOneAndUpdate.mockResolvedValueOnce({
      currentNodeId: 'approved',
      status: 'approved',
    });

    const updated = await approvalEngine.processStageApproval({
      instanceId: 'inst123',
      actorId: 'user123',
      action: 'approve',
      expectedVersion: 1,
    });

    expect(PayrollUpdate.updateMany).toHaveBeenCalledWith(
      { tenantId: 'tenant123', month: 8, year: 2026 },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'APPROVED' })
      })
    );
    expect(updated.status).toBe('approved');
  });

  test('processStageApproval should mark payroll rejected and set rejection details on reject', async () => {
    const mockInstance = {
      _id: 'inst123',
      tenantId: 'tenant123',
      currentNodeId: 'Finance',
      targetEntityId: 'payroll123',
      __v: 1,
    };
    WorkflowInstance.findById.mockResolvedValueOnce(mockInstance);
    PayrollUpdate.findById.mockResolvedValueOnce({ month: 8, year: 2026 });
    resolveRole.mockResolvedValueOnce({ role: { name: 'Finance' } });

    ApprovalWorkflow.findOne.mockResolvedValueOnce({
      sequence: ['HR', 'Finance', 'CFO']
    });

    WorkflowInstance.findOneAndUpdate.mockResolvedValueOnce({
      currentNodeId: 'rejected',
      status: 'rejected',
    });

    const updated = await approvalEngine.processStageApproval({
      instanceId: 'inst123',
      actorId: 'user123',
      action: 'reject',
      comment: 'Discrepancy in hours',
      expectedVersion: 1,
    });

    expect(PayrollUpdate.updateMany).toHaveBeenCalledWith(
      { tenantId: 'tenant123', month: 8, year: 2026 },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'Discrepancy in hours'
        })
      })
    );
    expect(updated.status).toBe('rejected');
  });
});
