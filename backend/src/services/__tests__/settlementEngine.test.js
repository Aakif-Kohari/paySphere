const { calculateSettlement } = require('../settlementEngine');
const { getClearanceStatus, submitClearanceSignoff, initiateExit } = require('../../controllers/settlement.controller');
const ExitClearance = require('../../models/exitClearance.model');
const Employee = require('../../models/employee.model');

// Mock models
jest.mock('../../models/exitClearance.model', () => {
  const mockFindOne = jest.fn();
  const mockFindOneAndUpdate = jest.fn();
  return {
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
  };
});

jest.mock('../../models/employee.model', () => {
  const mockFindOne = jest.fn();
  const mockUpdateOne = jest.fn();
  return {
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
  };
});

// Mock existing settlement calculations
jest.mock('../../utils/settlement', () => ({
  buildSettlement: jest.fn().mockResolvedValue({
    earnings: { proratedSalary: 1000, leaveEncashment: 200, gratuity: 0, bonus: 0, other: 0 },
    deductions: { noticeShortfall: 100, advanceRecovery: 0, assetRecovery: 0, other: 0 },
    grossEarnings: 1200,
    totalDeductions: 100,
    netSettlement: 1100,
    explanations: {},
  }),
  parseDate: jest.fn(val => val),
}));

// Mock logger & eventBus
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../event.service', () => ({
  emit: jest.fn(),
}));

describe('Exit Clearance & Settlement Engine (#1250)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calculateSettlement should incorporate training clawbacks', async () => {
    const mockEmployee = {
      _id: 'emp123',
      tenantId: 'tenant123',
      monthlySalary: 3000,
      joiningDate: new Date(),
    };

    const mockClearance = {
      employeeId: 'emp123',
      tenantId: 'tenant123',
      hasTrainingAgreement: true,
      trainingClawbackAmount: 500,
    };

    ExitClearance.findOne.mockResolvedValueOnce(mockClearance);

    const body = { lastWorkingDay: new Date() };
    const policy = {};

    const result = await calculateSettlement({ employee: mockEmployee, policy, body });

    expect(result.deductions.trainingClawback).toBe(500);
    expect(result.totalDeductions).toBe(600); // 100 base + 500 clawback
    expect(result.netSettlement).toBe(600); // 1200 gross - 600 total deductions
  });

  test('initiateExit should auto-create ExitClearance document', async () => {
    const mockEmployee = {
      _id: 'emp123',
      tenantId: 'tenant123',
      employmentStatus: 'Active',
      joiningDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    };

    Employee.findOne.mockResolvedValueOnce(mockEmployee);
    Employee.updateOne.mockResolvedValueOnce({});
    ExitClearance.findOneAndUpdate.mockResolvedValueOnce({});

    const req = {
      tenantId: 'tenant123',
      userId: 'admin123',
      body: {
        employeeId: 'emp123',
        lastWorkingDay: new Date(),
        hasTrainingAgreement: true,
        trainingClawbackAmount: 1500,
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await initiateExit(req, res, next);

    expect(Employee.updateOne).toHaveBeenCalled();
    expect(ExitClearance.findOneAndUpdate).toHaveBeenCalledWith(
      { employeeId: 'emp123', tenantId: 'tenant123' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          hasTrainingAgreement: true,
          trainingClawbackAmount: 1500,
        }),
      }),
      expect.any(Object)
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('submitClearanceSignoff should update step status and calculate overall status', async () => {
    const mockClearance = {
      employeeId: 'emp123',
      tenantId: 'tenant123',
      itClearance: { status: 'Pending' },
      hrClearance: { status: 'Cleared' },
      adminClearance: { status: 'Cleared' },
      status: 'Pending',
      save: jest.fn().mockResolvedValue({}),
    };

    ExitClearance.findOne.mockResolvedValueOnce(mockClearance);

    const req = {
      tenantId: 'tenant123',
      userId: 'admin123',
      body: {
        employeeId: 'emp123',
        department: 'it',
        status: 'Cleared',
        notes: 'Assets received',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await submitClearanceSignoff(req, res, next);

    expect(mockClearance.itClearance.status).toBe('Cleared');
    expect(mockClearance.status).toBe('Completed'); // All steps are now Cleared
    expect(mockClearance.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
