/**
 * ESOP routes — mounted at /api/esop (#1073).
 *
 * Three permissions rather than the usual read/write pair, because the three
 * acts here have genuinely different authority:
 *
 *   - READ_ESOP        the cap table for everybody in the company
 *   - MANAGE_ESOP      issuing a grant, which dilutes the cap table, and
 *                      recording an exercise, which creates a taxable event and
 *                      a TDS liability. Owner only.
 *   - READ_OWN_ESOP    an employee looking at their own grants
 *
 * The split matters more here than elsewhere in the product. Every other HR
 * write changes a record; a grant changes who owns the company. It is the same
 * reasoning that keeps MANAGE_CONTRACT away from the HR manager role (#1011) —
 * issuing an offer letter commits the company to a salary — one notch further
 * along.
 */

const express = require('express');

const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  createScheme,
  getSchemes,
  createGrant,
  getGrants,
  getVestingSchedule,
  exerciseOptions,
  forfeitGrant,
  getMyGrants,
} = require('../controllers/esop.controller');

const router = express.Router();

// --- Self-service ---------------------------------------------------------
//
// Declared first so `/my-grants` is matched before any `/:id` pattern below
// could claim it. `getMyGrants` resolves the employee from `req.userId`, so the
// route carries no identifier a caller could substitute.
router.get(
  '/my-grants',
  auth,
  requirePermission(PERMISSIONS.READ_OWN_ESOP),
  getMyGrants,
);

// --- Schemes --------------------------------------------------------------
router.post(
  '/schemes',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESOP),
  writeRateLimiter,
  createScheme,
);
router.get(
  '/schemes',
  auth,
  requirePermission(PERMISSIONS.READ_ESOP),
  getSchemes,
);

// --- Grants ---------------------------------------------------------------
router.post(
  '/grants',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESOP),
  writeRateLimiter,
  createGrant,
);
router.get(
  '/grants',
  auth,
  requirePermission(PERMISSIONS.READ_ESOP),
  getGrants,
);
router.get(
  '/grants/:id/schedule',
  auth,
  requirePermission(PERMISSIONS.READ_ESOP),
  getVestingSchedule,
);

// Recording an exercise writes a perquisite and a TDS figure that will be filed
// under the employer's TAN, so it sits with MANAGE_ESOP rather than with the
// employee doing the exercising.
router.post(
  '/grants/:id/exercise',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESOP),
  writeRateLimiter,
  exerciseOptions,
);
router.post(
  '/grants/:id/forfeit',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESOP),
  writeRateLimiter,
  forfeitGrant,
);

module.exports = router;
