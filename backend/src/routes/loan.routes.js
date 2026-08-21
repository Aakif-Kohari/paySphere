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
  getForeclosureQuote,
  forecloseLoan,
  recordPrepayment,
  getExitClearance,
  getPolicy,
  requestLoan,
  approveLoan,
  getMyLoans,
} = require('../controllers/loan.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Loan Request & Approval Workflow (Issue #1290) ------------------------

// Retrieve or initialize the tenant's loan policy
router.get('/policy', auth, getPolicy);

// Submit a new loan request for approval
router.post('/request', auth, writeRateLimiter, requestLoan);

// Get loans for the authenticated employee
router.get('/my-loans', auth, getMyLoans);

// Approve a pending loan request and generate amortization schedule
router.patch(
  '/:id/approve',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  approveLoan,
);

// --- Existing Loan Management Routes ---------------------------------------

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

// Also declared before `/:id`, for the same reason `/summary` is: `clearance`
// would otherwise be captured as a loan id and every request would 400 on the
// ObjectId check.
//
// A read, and gated as one — full-and-final settlement needs to know what a
// leaver still owes before it can compute their final payment (#1155).
router.get(
  '/clearance/:employeeId',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getExitClearance,
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

router.get(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getLoanById,
);

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

// --- Early closure (#1155) -------------------------------------------------

// Quoting a closure writes nothing, so it sits with the other reads. An
// employee asking what it costs to settle early must not be committed to
// settling by asking.
router.get(
  '/:id/foreclosure-quote',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getForeclosureQuote,
);

// Both of these move money and close or reshape a commitment, so they carry
// the same write permission and rate limit as issuing the loan did.
router.post(
  '/:id/foreclose',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  forecloseLoan,
);

router.post(
  '/:id/prepay',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  recordPrepayment,
);

module.exports = router;
