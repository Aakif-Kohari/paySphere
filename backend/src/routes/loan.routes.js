const express = require('express');
const {
  createLoan,
  getLoans,
  getLoanById,
  getLoanSchedule,
  getLoanSummary,
  previewLoanSchedule,
  updateLoanStatus,
  recordManualRepayment,
} = require('../controllers/loan.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// A loan changes what an employee is paid, so it is guarded with the payroll
// permissions rather than the employee ones: reading a loan is reading payroll
// data, and issuing one commits future deductions.

router.get('/', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getLoans);

// Declared before `/:id` so the literal segment is not captured as an id.
router.get(
  '/summary',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getLoanSummary,
);

// Preview writes nothing, so the admin can model the instalment before
// committing to it.
router.post(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  previewLoanSchedule,
);

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  createLoan,
);

router.get('/:id', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getLoanById);

router.get(
  '/:id/schedule',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getLoanSchedule,
);

router.patch(
  '/:id/status',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  updateLoanStatus,
);

router.post(
  '/:id/repay',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  recordManualRepayment,
);

module.exports = router;
