/**
 * Payroll Approval Service - Issue #1110
 *
 * Manages the multi-stage payroll approval chain.
 * Uses optimistic locking (__v) so two approvers acting simultaneously
 * get a clear 409 instead of a silent last-write-wins overwrite.
 */
'use strict';

const WorkflowInstance = require('../models/workflowInstance.model');
const logger = require('../utils/logger');

/**
 * Move a workflow instance one stage forward.
 * Throws with status 409 when another actor updated it since the caller loaded it.
 */
async function advanceStage({ instanceId, actorId, action, comment, nextNodeId, terminalNodeId, expectedVersion }) {
  if (action === 'reject' && (!comment || !comment.trim())) {
    const err = new Error('A rejection reason is required.');
    err.status = 422;
    throw err;
  }

  const historyEntry = {
    actionBy: actorId,
    action,
    comment:  comment || '',
    timestamp: new Date(),
    nodeId: action === 'approve' ? nextNodeId : terminalNodeId,
  };

  const updated = await WorkflowInstance.findOneAndUpdate(
    { _id: instanceId, __v: expectedVersion },
    {
      $inc: { __v: 1 },
      $set: {
        currentNodeId: action === 'approve' ? nextNodeId : terminalNodeId,
        status: action === 'approve' ? 'in_progress' : 'rejected',
      },
      $push: { history: historyEntry },
    },
    { new: true }
  );

  if (!updated) {
    const err = new Error('This payroll was already updated by someone else. Please refresh and try again.');
    err.status = 409;
    throw err;
  }

  logger.info('Payroll workflow stage advanced', { instanceId, actorId, action, newNode: updated.currentNodeId });
  return updated;
}

module.exports = { advanceStage };