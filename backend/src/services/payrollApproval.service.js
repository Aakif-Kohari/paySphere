/**
 * Payroll Approval Service - Issue #1247
 *
 * Manages the multi-stage payroll approval chain with:
 *   - Optimistic locking (__v) for concurrent approval safety
 *   - Stage locking: prevent two approvers from acting on the same stage
 *   - Escalation: auto-escalate stale approvals after a deadline
 *   - Stage log: detailed audit trail of every stage transition
 */
'use strict';

const WorkflowInstance = require('../models/workflowInstance.model');
const logger = require('../utils/logger');

const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_ESCALATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Advance a workflow instance one stage forward.
 * Uses findOneAndUpdate with version assertion for optimistic concurrency.
 * Throws 409 on stale update, 423 if locked, 422 if rejection without comment.
 */
async function advanceStage({ instanceId, actorId, action, comment, nextNodeId, terminalNodeId, expectedVersion }) {
  if (action === 'reject' && (!comment || !comment.trim())) {
    const err = new Error('A rejection reason is required.');
    err.status = 422;
    throw err;
  }

  // Check lock before advancing
  const instance = await WorkflowInstance.findById(instanceId);
  if (!instance) {
    const err = new Error('Workflow instance not found.');
    err.status = 404;
    throw err;
  }

  // Verify lock
  if (instance.lockedBy && instance.lockExpiresAt && instance.lockExpiresAt > new Date()) {
    if (String(instance.lockedBy) !== String(actorId)) {
      const err = new Error('This payroll is currently locked by another approver. Please wait or contact them.');
      err.status = 423;
      throw err;
    }
  }

  const historyEntry = {
    actionBy: actorId,
    action,
    comment: comment || '',
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
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
      $push: { history: historyEntry },
    },
    { new: true },
  );

  if (!updated) {
    const err = new Error('This payroll was already updated by someone else. Please refresh and try again.');
    err.status = 409;
    throw err;
  }

  // Update stageChain status for the current stage
  await updateStageChainStatus(updated, actorId, action, comment);

  // Set escalation deadline for the next stage if approving
  if (action === 'approve' && nextNodeId !== 'approved') {
    await WorkflowInstance.findByIdAndUpdate(instanceId, {
      $set: {
        escalationDeadlineAt: new Date(Date.now() + DEFAULT_ESCALATION_WINDOW_MS),
        escalatedAt: null,
      },
    });
  }

  logger.info('Payroll workflow stage advanced', { instanceId, actorId, action, newNode: updated.currentNodeId });
  return updated;
}

/**
 * Lock a stage so only the lock holder can act on it.
 * Returns 423 if already locked by a different actor.
 */
async function lockStage(instanceId, actorId, ttlMs = DEFAULT_LOCK_TTL_MS) {
  const instance = await WorkflowInstance.findById(instanceId);
  if (!instance) {
    const err = new Error('Workflow instance not found.');
    err.status = 404;
    throw err;
  }

  if (instance.lockedBy && instance.lockExpiresAt && instance.lockExpiresAt > new Date() && String(instance.lockedBy) !== String(actorId)) {
    const err = new Error('Stage is already locked by another approver.');
    err.status = 423;
    throw err;
  }

  const now = new Date();
  const updated = await WorkflowInstance.findByIdAndUpdate(
    instanceId,
    { $set: { lockedBy: actorId, lockedAt: now, lockExpiresAt: new Date(now.getTime() + ttlMs) } },
    { new: true },
  );

  await WorkflowInstance.findByIdAndUpdate(instanceId, {
    $push: {
      stageLog: {
        stageIndex: getCurrentStageIndex(updated),
        stageName: updated.currentNodeId,
        actorId,
        action: 'locked',
        timestamp: now,
      },
    },
  });

  logger.info('Payroll stage locked', { instanceId, actorId, ttlMs });
  return updated;
}

/**
 * Release a lock if the caller is the lock holder.
 */
async function releaseLock(instanceId, actorId) {
  const instance = await WorkflowInstance.findById(instanceId);
  if (!instance) {
    const err = new Error('Workflow instance not found.');
    err.status = 404;
    throw err;
  }

  if (!instance.lockedBy || String(instance.lockedBy) !== String(actorId)) {
    const err = new Error('You are not the lock holder for this stage.');
    err.status = 403;
    throw err;
  }

  const updated = await WorkflowInstance.findByIdAndUpdate(
    instanceId,
    { $set: { lockedBy: null, lockedAt: null, lockExpiresAt: null } },
    { new: true },
  );

  logger.info('Payroll stage lock released', { instanceId, actorId });
  return updated;
}

/**
 * Escalate stale approvals: find instances past their escalationDeadlineAt
 * that have not been escalated yet, and mark them escalated.
 * Called by the BullMQ escalation job every 15 minutes.
 */
async function escalateStaleApprovals(maxAgeMs = 48 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const staleInstances = await WorkflowInstance.find({
    status: 'in_progress',
    escalationDeadlineAt: { $lte: new Date() },
    escalatedAt: null,
    createdAt: { $gte: cutoff },
  }).limit(50);

  const escalated = [];

  for (const instance of staleInstances) {
    try {
      const currentStageIndex = getCurrentStageIndex(instance);
      const nextStage = instance.stageChain && instance.stageChain[currentStageIndex + 1];

      if (!nextStage) {
        logger.warn('No next stage for escalation', { instanceId: String(instance._id) });
        continue;
      }

      const now = new Date();
      await WorkflowInstance.findByIdAndUpdate(instance._id, {
        $set: { escalatedAt: now, escalationDeadlineAt: null },
        $push: {
          stageLog: {
            stageIndex: currentStageIndex,
            stageName: instance.currentNodeId,
            action: 'escalated',
            comment: 'Auto-escalated due to inactivity.',
            timestamp: now,
          },
        },
      });

      escalated.push(instance);
      logger.info('Payroll approval escalated', {
        instanceId: String(instance._id),
        currentNode: instance.currentNodeId,
        escalatedTo: nextStage.roleName,
      });
    } catch (err) {
      logger.error('Escalation failed for instance', { instanceId: String(instance._id), error: err.message });
    }
  }

  return escalated;
}

// --- Helpers ---

function getCurrentStageIndex(instance) {
  if (!instance.stageChain || instance.stageChain.length === 0) return 0;
  const idx = instance.stageChain.findIndex(
    (s) => s.roleName === instance.currentNodeId || s.stageName === instance.currentNodeId,
  );
  return idx >= 0 ? idx : 0;
}

async function updateStageChainStatus(instance, actorId, action, comment) {
  const currentIdx = getCurrentStageIndex(instance);
  const updateFields = {};
  updateFields['stageChain.' + currentIdx + '.status'] = action === 'approve' ? 'approved' : 'rejected';
  updateFields['stageChain.' + currentIdx + '.actorId'] = actorId;
  updateFields['stageChain.' + currentIdx + '.actedAt'] = new Date();
  updateFields['stageChain.' + currentIdx + '.comment'] = comment || '';
  if (action === 'approve' && instance.stageChain[currentIdx + 1]) {
    updateFields['stageChain.' + (currentIdx + 1) + '.status'] = 'active';
  }
  await WorkflowInstance.findByIdAndUpdate(instance._id, { $set: updateFields });
}

module.exports = { advanceStage, lockStage, releaseLock, escalateStaleApprovals };
