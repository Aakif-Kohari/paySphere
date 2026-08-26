/**
 * Payroll Approval Routes - Issue #1247
 * Mounted at /api/payroll in app.js
 */
'use strict';

const { Router }            = require('express');
const auth                  = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS }       = require('../config/permissions');
const {
  approveStage,
  rejectStage,
  lockStage,
  releaseLock,
  getApprovalStatus,
  saveApprovalWorkflow,
} = require('../controllers/payrollApproval.controller');

const router = Router();

router.get('/:payrollId/approval-status', auth, requirePermission(PERMISSIONS.READ_PAYROLL),  getApprovalStatus);
router.post('/:payrollId/approve',        auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), approveStage);
router.post('/:payrollId/reject',         auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), rejectStage);
router.post('/:payrollId/lock',           auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), lockStage);
router.delete('/:payrollId/lock',         auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), releaseLock);
router.post('/approval-workflow',          auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), saveApprovalWorkflow);

module.exports = router;
