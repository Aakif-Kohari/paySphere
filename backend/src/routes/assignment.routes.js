const express = require('express');

const {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  addPresencePeriod,
  projectCost,
  calculateGrossUp,
  settleYear,
} = require('../controllers/assignment.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- International assignments (#1348) -------------------------------------
//
// Deliberately not gated on the travel permissions next door. An assignment is
// not a long trip: it changes where the employee is tax resident, commits the
// employer to bearing somebody's foreign tax bill for years, and creates a
// filing obligation in a second country. That is closer to MANAGE_COMPLIANCE
// than to approving a per-diem, and the populations are different people.

router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.READ_ASSIGNMENT),
  listAssignments,
);

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ASSIGNMENT),
  writeRateLimiter,
  createAssignment,
);

router.get(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.READ_ASSIGNMENT),
  getAssignment,
);

router.patch(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ASSIGNMENT),
  writeRateLimiter,
  updateAssignment,
);

// Logging a trip is not an assignment amendment — it is a fact about where
// somebody was, recorded routinely and often by the traveller's own team. It
// carries the write permission because it changes the day count that decides a
// filing obligation, and it is the lightest write in the module.
router.post(
  '/:id/presence',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ASSIGNMENT),
  writeRateLimiter,
  addPresencePeriod,
);

// Writes nothing unless `approve` is set. The package is reshaped several times
// before anybody signs off on it, and each reshaping should not leave a record
// claiming it was approved.
router.post(
  '/:id/cost-projection',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ASSIGNMENT),
  projectCost,
);

// A calculator. Used while a package is being negotiated rather than after, so
// it is gated as a read.
router.post(
  '/:id/gross-up',
  auth,
  requirePermission(PERMISSIONS.READ_ASSIGNMENT),
  calculateGrossUp,
);

// The year-end settlement, which decides money moving between the employee and
// the company in one direction or the other.
router.post(
  '/:id/settlements',
  auth,
  requirePermission(PERMISSIONS.SETTLE_ASSIGNMENT_TAX),
  writeRateLimiter,
  settleYear,
);

module.exports = router;
