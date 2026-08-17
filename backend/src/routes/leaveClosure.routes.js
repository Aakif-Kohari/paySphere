const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  getClosurePolicies,
  previewClosure,
  runClosure,
  getClosureHistory,
} = require('../controllers/leaveClosure.controller');

const router = express.Router();

// Gated on the payroll permissions rather than the employee ones, and
// deliberately so. A leave close is not leave admin: it pays money out — the
// encashment lands on a payslip as taxable earnings — and it writes days off
// an employee's balance permanently. Reading what a close will do is reading
// payroll data; running one commits a payment.
//
// No new permission names are introduced for it. READ_PAYROLL and
// WRITE_PAYROLL already describe these two acts exactly, and adding a
// vocabulary that no seeded role holds is how #794 left every expense endpoint
// answering 403 for every account in the product.

router.get(
  '/policies',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getClosurePolicies,
);

router.get(
  '/history',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getClosureHistory,
);

// A POST that writes nothing. It takes the leave year and an optional leave
// type filter in the body and answers with the whole close as it would run,
// so nobody discovers what was paid out and written off after the fact.
router.post(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  previewClosure,
);

router.post(
  '/run',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  runClosure,
);

module.exports = router;
