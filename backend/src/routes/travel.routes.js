/**
 * Travel routes — mounted at /api/travel (#1077, #1148).
 */

const express = require('express');

const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  upsertPolicy,
  getPolicies,
  createRequest,
  getRequests,
  approveRequest,
  rejectRequest,
  releaseAdvance,
  settleRequest,
  getOutstandingAdvances,
  getMyTrips,
  getTravelVarianceReport,
  settleMultiCurrencyTrip,
} = require('../controllers/travel.controller');

const router = express.Router();

// --- Self-service ---------------------------------------------------------
router.get(
  '/my-trips',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_TRAVEL_REQUEST),
  getMyTrips,
);

// --- Executive Variance Reports -------------------------------------------
router.get(
  '/variance-report',
  auth,
  requirePermission(PERMISSIONS.READ_TRAVEL),
  getTravelVarianceReport,
);

// --- Policy ---------------------------------------------------------------
router.post(
  '/policies',
  auth,
  requirePermission(PERMISSIONS.MANAGE_TRAVEL_POLICY),
  writeRateLimiter,
  upsertPolicy,
);
router.get(
  '/policies',
  auth,
  requirePermission(PERMISSIONS.READ_TRAVEL),
  getPolicies,
);

// --- Requests -------------------------------------------------------------
router.post(
  '/requests',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_TRAVEL_REQUEST),
  writeRateLimiter,
  createRequest,
);
router.get(
  '/requests',
  auth,
  requirePermission(PERMISSIONS.READ_TRAVEL),
  getRequests,
);

// --- Approval and money ---------------------------------------------------
router.post(
  '/requests/:id/approve',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  approveRequest,
);
router.post(
  '/requests/:id/reject',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  rejectRequest,
);
router.post(
  '/requests/:id/advance',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  releaseAdvance,
);
router.post(
  '/requests/:id/settle',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  settleRequest,
);
router.post(
  '/requests/:id/multi-currency-settle',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  settleMultiCurrencyTrip,
);

// --- Receivables ----------------------------------------------------------
router.get(
  '/advances/outstanding',
  auth,
  requirePermission(PERMISSIONS.READ_TRAVEL),
  getOutstandingAdvances,
);

module.exports = router;
