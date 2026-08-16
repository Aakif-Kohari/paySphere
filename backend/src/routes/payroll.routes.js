/**
 * Payroll routes.
 *
 * Restored in #1078. #1057's branch was cut from a base predating most of this
 * file, so its merge replaced a 123-line router with a 10-line one and took
 * nine endpoints off the table:
 *
 *     POST /parse-csv          POST /approve          POST /send-email/:id
 *     GET  /approvals          POST /reject           POST /send-all-emails
 *     GET  /export-csv         POST /mark-paid        GET  /:id/merkle-proof
 *
 * The two that survived were rewritten to `requireScope`, and `/finalize` was
 * pointed at `finalizePayroll` — a name `payroll.controller.js` does not
 * export. Express refuses a non-function handler at mount time, so this file
 * threw `TypeError: argument handler must be a function` while `app.js` was
 * being required. That is the second half of "the backend does not boot": even
 * with `requirePermission` restored, `require('./app')` still died here.
 *
 * `routes/__tests__/payroll.routes.test.js` has asserted the full table and its
 * permissions the whole time, including the maker–checker split. It could not
 * report the loss because it mounts the router itself and stubs the middleware,
 * so it fails on the missing handler rather than on the missing routes.
 *
 * Two lineages of this file are both ancestors of `main` — one added
 * `/fx-rates` (#861), the other `/:id/merkle-proof` (#907) — and an earlier
 * merge had already dropped the first. This is the union, so neither is lost
 * again.
 */

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
  getExchangeRates,
  getMerkleProofHandler,
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

// Live FX rates for the multi-currency disbursement fields on the payroll model
// (#861). Declared above `/:id/merkle-proof` because a literal segment and a
// parameterised one at the same depth are matched in declaration order, and
// `/fx-rates` would otherwise be swallowed by `/:id`.
router.get(
  '/fx-rates',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getExchangeRates,
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
  '/:id/merkle-proof',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getMerkleProofHandler,
);

module.exports = router;
