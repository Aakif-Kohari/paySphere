const express = require('express');

const {
  submitClaim,
  previewClaim,
  getEntitlement,
  getMyClaims,
  getQueue,
  verifyClaim,
  getBlockSummary,
} = require('../controllers/lta.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Self-service (#1345) --------------------------------------------------
//
// Gated exactly like the tax proof portal it sits next to: an employee files
// their own journey, and the handler resolves the employee from `req.userId`
// unless an explicit id is sent — so holding SUBMIT_LTA_CLAIM does not let one
// employee claim in a colleague's name.

// Declared before the parameterised routes below so the literal segments are
// not captured as ids.
router.get(
  '/entitlement',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_LTA_CLAIM),
  getEntitlement,
);

router.get(
  '/my-claims',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_LTA_CLAIM),
  getMyClaims,
);

// Writes nothing. Worth having as its own route because an employee about to
// book business class should learn that only the economy fare is exempt before
// they book rather than after.
router.post(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_LTA_CLAIM),
  previewClaim,
);

router.post(
  '/claims',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_LTA_CLAIM),
  writeRateLimiter,
  submitClaim,
);

// --- Verification ----------------------------------------------------------
//
// Approving a claim decides how much of somebody's LTA escapes tax, and
// therefore the TDS deducted from their salary for the rest of the year. Same
// authority as VERIFY_TAX_PROOF, and held by the same population.

router.get(
  '/queue',
  auth,
  requirePermission(PERMISSIONS.VERIFY_LTA_CLAIM),
  getQueue,
);

router.patch(
  '/claims/:id/verify',
  auth,
  requirePermission(PERMISSIONS.VERIFY_LTA_CLAIM),
  writeRateLimiter,
  verifyClaim,
);

// The block position that Form 16 Part B reports. A read of one employee's
// whole four-year history, so it carries the verifier's permission rather than
// the employee's.
router.get(
  '/summary/:employeeId',
  auth,
  requirePermission(PERMISSIONS.VERIFY_LTA_CLAIM),
  getBlockSummary,
);

module.exports = router;
