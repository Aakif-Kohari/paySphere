const express = require('express');
const {
  submitPayrollForReview,
  parsePayrollCSV,
  getPayrollSummary,
  exportPayrollCSV,
  sendPayslipEmailHandler,
  sendAllPayslipsEmailHandler,
  getPendingApprovals,
  approvePayroll,
  rejectPayroll,
  markPayrollPaid,
  inspectAnomalies,
} = require('../controllers/payroll.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const upload = require('../middlewares/upload.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const router = express.Router();

// #413 closed a hole where the payroll routes ran on `auth` alone while merely
// listing employees required a permission. #438 reopened it: `requirePermission`
// stayed imported but was applied to `/parse-csv` only, so a read-only Employee
// role could once again finalize payroll, export salary data and dispatch
// payslip emails. Every route below is guarded again (#458).

router.post(
  '/parse-csv',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  upload.single('file'),
  parsePayrollCSV,
);

// --- Maker: submit a run for review ---------------------------------------
router.post(
  '/finalize',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  submitPayrollForReview,
);

// --- Checker: review the queue and sign off -------------------------------
//
// These three handlers existed in the controller since #438 but were never
// mounted, so `frontend/src/pages/Approvals.jsx` 404'd on all of them and the
// approval workflow was unreachable end to end.
//
// APPROVE_PAYROLL is a distinct permission from WRITE_PAYROLL so the maker and
// the checker can be different people — an approval flow where the submitter
// can approve their own submission is decorative.
router.get(
  '/approvals',
  auth,
  requirePermission(PERMISSIONS.APPROVE_PAYROLL),
  getPendingApprovals,
);
router.post(
  '/approve',
  auth,
  requirePermission(PERMISSIONS.APPROVE_PAYROLL),
  writeRateLimiter,
  approvePayroll,
);
router.post(
  '/reject',
  auth,
  requirePermission(PERMISSIONS.APPROVE_PAYROLL),
  writeRateLimiter,
  rejectPayroll,
);

// Disbursement. `paid` is the terminal state that #251's re-finalise guard and
// #345's delete guard both key off, and nothing could reach it until now.
router.post(
  '/mark-paid',
  auth,
  requirePermission(PERMISSIONS.APPROVE_PAYROLL),
  writeRateLimiter,
  markPayrollPaid,
);

// --- Read / export --------------------------------------------------------
router.get(
  '/summary',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getPayrollSummary,
);
router.get(
  '/export-csv',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  exportPayrollCSV,
);

// --- Payslip dispatch -----------------------------------------------------
router.post(
  '/send-email/:id',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  sendPayslipEmailHandler,
);
router.post(
  '/send-all-emails',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  sendAllPayslipsEmailHandler,
);

router.get(
  '/anomalies',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  inspectAnomalies,
);

module.exports = router;
