const ApprovalWorkflow = require('../models/approvalWorkflow.model');
const WorkflowInstance = require('../models/workflowInstance.model');
const PayrollUpdate = require('../models/payroll.model');
const User = require('../models/user.model');
const { resolveRole } = require('../middlewares/rbac.middleware');
const { PAYROLL_STATUS } = require('../config/payrollStatus');
const logger = require('../utils/logger');

/**
 * Service to process multi-level multi-role sign-off workflows for payroll runs.
 */
class ApprovalEngine {
  /**
   * Resolves the active approval workflow sequence for a tenant.
   * 
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<{name: string, sequence: string[]}>}
   */
  async getWorkflowForTenant(tenantId) {
    const workflow = await ApprovalWorkflow.findOne({ tenantId, isActive: true });
    if (workflow) {
      return { name: workflow.name, sequence: workflow.sequence };
    }
    // Default fallback sequence if no custom workflow is configured
    return { name: 'Default Payroll Approval Workflow', sequence: ['HR', 'Finance', 'CFO'] };
  }

  /**
   * Processes a workflow approval or rejection stage.
   * 
   * @param {object} params
   * @param {string} params.instanceId - WorkflowInstance ID
   * @param {string} params.actorId - Approver User ID
   * @param {string} params.action - 'approve' or 'reject'
   * @param {string} [params.comment] - Optional review comment
   * @param {number} params.expectedVersion - Expected document version for concurrency protection
   * @returns {Promise<object>} The updated WorkflowInstance
   */
  async processStageApproval({ instanceId, actorId, action, comment, expectedVersion }) {
    if (action === 'reject' && (!comment || !comment.trim())) {
      const err = new Error('A rejection reason is required.');
      err.status = 422;
      throw err;
    }

    // 1. Fetch current workflow instance
    const instance = await WorkflowInstance.findById(instanceId);
    if (!instance) {
      const err = new Error('Workflow instance not found.');
      err.status = 404;
      throw err;
    }

    // Concurrency version check
    if (instance.__v !== expectedVersion) {
      const err = new Error('This payroll run was already updated by another action. Please refresh.');
      err.status = 409;
      throw err;
    }

    // 2. Resolve actor's role
    const { role } = await resolveRole(actorId);
    const actorRoleName = role ? role.name : null;

    if (!actorRoleName) {
      const err = new Error('Actor does not have a designated system role.');
      err.status = 403;
      throw err;
    }

    // 3. Resolve the active workflow sequence
    const { sequence } = await this.getWorkflowForTenant(instance.tenantId);

    // Verify if the current node matches the actor's role
    // (Support fallback for legacy node IDs like 'finance_review' or 'cfo_approval' by mapping them to role names)
    let expectedRole = instance.currentNodeId;
    if (expectedRole === 'finance_review') expectedRole = 'Finance';
    if (expectedRole === 'cfo_approval') expectedRole = 'CFO';

    if (actorRoleName.toLowerCase() !== expectedRole.toLowerCase()) {
      const err = new Error(`Action forbidden. This stage requires approval from the ${instance.currentNodeId} role.`);
      err.status = 403;
      throw err;
    }

    // Determine target payroll month/year to update corresponding rows
    const firstPayrollRow = await PayrollUpdate.findById(instance.targetEntityId);
    if (!firstPayrollRow) {
      const err = new Error('Target payroll entity not found.');
      err.status = 404;
      throw err;
    }
    const { month, year } = firstPayrollRow;

    let nextNodeId = 'approved';
    let nextStatus = 'approved';

    if (action === 'approve') {
      const currentIndex = sequence.findIndex(role => role.toLowerCase() === actorRoleName.toLowerCase());
      if (currentIndex !== -1 && currentIndex < sequence.length - 1) {
        nextNodeId = sequence[currentIndex + 1];
        nextStatus = 'in_progress';
      }
    } else {
      nextNodeId = 'rejected';
      nextStatus = 'rejected';
    }

    const historyEntry = {
      actionBy: actorId,
      action,
      comment: comment || '',
      timestamp: new Date(),
      nodeId: nextNodeId
    };

    // 4. Update the workflow instance
    const updatedInstance = await WorkflowInstance.findOneAndUpdate(
      { _id: instanceId, __v: expectedVersion },
      {
        $inc: { __v: 1 },
        $set: {
          currentNodeId: nextNodeId,
          status: nextStatus
        },
        $push: { history: historyEntry }
      },
      { new: true }
    );

    if (!updatedInstance) {
      const err = new Error('Concurrency conflict detected. Please retry.');
      err.status = 409;
      throw err;
    }

    // 5. If terminal state reached, update all corresponding PayrollUpdate rows
    if (nextStatus === 'approved') {
      await PayrollUpdate.updateMany(
        { tenantId: instance.tenantId, month, year },
        {
          $set: {
            status: PAYROLL_STATUS.APPROVED,
            approvedBy: actorId,
            approvedAt: new Date()
          }
        }
      );
      logger.info(`Payroll run for ${month}/${year} fully APPROVED by chain.`);
    } else if (nextStatus === 'rejected') {
      await PayrollUpdate.updateMany(
        { tenantId: instance.tenantId, month, year },
        {
          $set: {
            status: PAYROLL_STATUS.REJECTED,
            rejectedBy: actorId,
            rejectedAt: new Date(),
            rejectionReason: comment
          }
        }
      );
      logger.warn(`Payroll run for ${month}/${year} REJECTED by ${actorRoleName}.`);
    }

    return updatedInstance;
  }
}

module.exports = new ApprovalEngine();
