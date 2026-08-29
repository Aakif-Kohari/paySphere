/**
 * ESOP routes — mounted at /api/esop (#1073, #1147).
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
  createTenderOffer,
  getTenderOffers,
  submitTenderBid,
  settleTenderOffer,
} = require('../controllers/esop.controller');

const router = express.Router();

// --- Self-service ---------------------------------------------------------
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

// POST /api/esop/grants/:id/exercise
// Exercises options and feeds perquisite TDS deductions into the monthly payroll run.
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

// --- Secondary Liquidity Tender Offers ------------------------------------
router.post(
  '/tender-offers',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESOP),
  writeRateLimiter,
  createTenderOffer,
);
router.get(
  '/tender-offers',
  auth,
  requirePermission(PERMISSIONS.READ_ESOP),
  getTenderOffers,
);
router.post(
  '/tender-offers/:id/bid',
  auth,
  requirePermission(PERMISSIONS.READ_OWN_ESOP),
  writeRateLimiter,
  submitTenderBid,
);
router.post(
  '/tender-offers/:id/settle',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ESOP),
  writeRateLimiter,
  settleTenderOffer,
);

module.exports = router;
