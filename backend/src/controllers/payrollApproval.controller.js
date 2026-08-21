/**
 * Payroll Approval Controller - Issue #1110
 *
 * POST /api/payroll/:payrollId/approve          - approve the current stage
 * POST /api/payroll/:payrollId/reject           - reject with mandatory comment
 * GET  /api/payroll/:payrollId/approval-status  - full stage history
 */
'use strict';

const WorkflowInstance  = require('../models/workflowInstance.model');
const approvalEngine    = require('../services/approvalEngine');
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

    const updated = await approvalEngine.processStageApproval({
      instanceId: instance._id,
      actorId: req.userId,
      action: 'approve',
      comment: req.body.comment || '',
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

    const updated = await approvalEngine.processStageApproval({
      instanceId: instance._id,
      actorId: req.userId,
      action: 'reject',
      comment: req.body.comment,
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

async function saveApprovalWorkflow(req, res, next) {
  try {
    const { name, sequence } = req.body;
    if (!name || !sequence || !Array.isArray(sequence) || sequence.length === 0) {
      return res.status(400).json({ message: 'name and sequence are required' });
    }

    const ApprovalWorkflow = require('../models/approvalWorkflow.model');
    await ApprovalWorkflow.updateMany(
      { tenantId: req.tenantId, isActive: true },
      { $set: { isActive: false, effectiveTo: new Date() } }
    );

    const workflow = await ApprovalWorkflow.create({
      tenantId: req.tenantId,
      name,
      sequence,
      isActive: true,
      effectiveFrom: new Date()
    });

    res.status(201).json({ message: 'Approval workflow configuration saved', workflow });
  } catch (error) {
    next(error);
  }
}

module.exports = { approveStage, rejectStage, getApprovalStatus, saveApprovalWorkflow };