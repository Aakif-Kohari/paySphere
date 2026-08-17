/**
 * Payroll Approval Controller - Issue #1110
 *
 * POST /api/payroll/:payrollId/approve          - approve the current stage
 * POST /api/payroll/:payrollId/reject           - reject with mandatory comment
 * GET  /api/payroll/:payrollId/approval-status  - full stage history
 */
'use strict';

const WorkflowInstance  = require('../models/workflowInstance.model');
const { advanceStage }  = require('../services/payrollApproval.service');
const { tenantFilter }  = require('../utils/tenantScope');
const logger            = require('../utils/logger');

async function findInstance(payrollId, tenantId) {
  return WorkflowInstance.findOne({
    ...tenantFilter({ tenantId }),
    targetEntityId: payrollId,
    targetEntityType: 'PayrollUpdate',
    status: { $in: ['pending', 'in_progress'] },
  });
}

async function approveStage(req, res) {
  try {
    const instance = await findInstance(req.params.payrollId, req.tenantId);
    if (!instance) return res.status(404).json({ message: 'No open approval workflow found for this payroll run.' });

    const updated = await advanceStage({
      instanceId: instance._id,
      actorId: req.userId,
      action: 'approve',
      comment: req.body.comment || '',
      nextNodeId: req.body.nextNodeId || 'finance_review',
      terminalNodeId: req.body.terminalNodeId || 'approved',
      expectedVersion: instance.__v,
    });

    return res.json({ message: 'Stage approved.', status: updated.status, currentNode: updated.currentNodeId });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('approveStage error', { error: err.message });
    return res.status(500).json({ message: 'Approval failed. Please try again.' });
  }
}

async function rejectStage(req, res) {
  try {
    const instance = await findInstance(req.params.payrollId, req.tenantId);
    if (!instance) return res.status(404).json({ message: 'No open approval workflow found for this payroll run.' });

    const updated = await advanceStage({
      instanceId: instance._id,
      actorId: req.userId,
      action: 'reject',
      comment: req.body.comment,
      nextNodeId: 'rejected',
      terminalNodeId: 'rejected',
      expectedVersion: instance.__v,
    });

    return res.json({ message: 'Stage rejected.', status: updated.status });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('rejectStage error', { error: err.message });
    return res.status(500).json({ message: 'Rejection failed. Please try again.' });
  }
}

async function getApprovalStatus(req, res) {
  try {
    const instance = await WorkflowInstance.findOne({
      ...tenantFilter({ tenantId: req.tenantId }),
      targetEntityId: req.params.payrollId,
      targetEntityType: 'PayrollUpdate',
    }).populate('history.actionBy', 'fullName email');

    if (!instance) return res.status(404).json({ message: 'No approval workflow found for this payroll run.' });

    return res.json({
      status:      instance.status,
      currentNode: instance.currentNodeId,
      history:     instance.history,
      version:     instance.__v,
    });
  } catch (err) {
    logger.error('getApprovalStatus error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch approval status.' });
  }
}

module.exports = { approveStage, rejectStage, getApprovalStatus };