const express = require('express');

const {
  previewComputation,
  commitComputation,
  listComputations,
  getComputation,
  getLedger,
  exportFormC,
  markPaid,
} = require('../controllers/statutoryBonus.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Payment of Bonus Act, 1965 (#1346) ------------------------------------
//
// Gated on its own permissions rather than on READ_PAYROLL and WRITE_PAYROLL.
// A statutory bonus computation reads the company's gross profit and the
// section 6 prior charges — figures out of the audited accounts that payroll
// staff have no other reason to see — and committing one declares what the
// establishment owes under a statute, which is closer to MANAGE_COMPLIANCE than
// to running a payroll month.

// Declared before `/computations/:id` so the literal segment is not captured.
router.get(
  '/ledger',
  auth,
  requirePermission(PERMISSIONS.READ_STATUTORY_BONUS),
  getLedger,
);

// Writes nothing. The gross profit and prior charges are argued over before
// they settle, so the year gets computed several times — and a preview that
// consumed carried set-on would make the second run disagree with the first.
router.post(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_STATUTORY_BONUS),
  previewComputation,
);

router.get(
  '/computations',
  auth,
  requirePermission(PERMISSIONS.READ_STATUTORY_BONUS),
  listComputations,
);

router.post(
  '/computations',
  auth,
  requirePermission(PERMISSIONS.MANAGE_STATUTORY_BONUS),
  writeRateLimiter,
  commitComputation,
);

router.get(
  '/computations/:id',
  auth,
  requirePermission(PERMISSIONS.READ_STATUTORY_BONUS),
  getComputation,
);

// The Rule 5 register. A read, and a fairly sensitive one — it is every
// eligible employee's wage and bonus in one file — but it is the document an
// inspection asks for, so it stays with the read permission rather than
// becoming a third name.
router.get(
  '/computations/:id/form-c',
  auth,
  requirePermission(PERMISSIONS.READ_STATUTORY_BONUS),
  exportFormC,
);

router.patch(
  '/computations/:id/paid',
  auth,
  requirePermission(PERMISSIONS.MANAGE_STATUTORY_BONUS),
  writeRateLimiter,
  markPaid,
);

module.exports = router;
