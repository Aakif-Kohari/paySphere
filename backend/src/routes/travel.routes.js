/**
 * Travel routes — mounted at /api/travel (#1077).
 *
 * Four permissions, split along the same maker–checker line as expenses (#719):
 *
 *   - READ_TRAVEL           trips, settlements and the outstanding-advance ledger
 *   - SUBMIT_TRAVEL_REQUEST file a trip. Held by employees — filing for a trip
 *                           you are about to take is the point of the feature.
 *   - APPROVE_TRAVEL        approve, reject, release an advance and settle. HR.
 *                           Kept apart from submission for the same reason
 *                           APPROVE_EXPENSE is kept apart from WRITE_EXPENSE:
 *                           whoever asks for the money should not be the only
 *                           person standing between it and a bank transfer.
 *   - MANAGE_TRAVEL_POLICY  set the grade × city-class rate table. Owner only —
 *                           the policy decides what everybody in the company is
 *                           entitled to, so editing it is not a per-trip
 *                           decision.
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
} = require('../controllers/travel.controller');

const router = express.Router();

// --- Self-service ---------------------------------------------------------
//
// Declared first so it cannot be shadowed by a `/:id` pattern. `getMyTrips`
// resolves the employee from `req.userId`, so the route carries no identifier a
// caller could substitute.
router.get(
  '/my-trips',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_TRAVEL_REQUEST),
  getMyTrips,
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

// --- Receivables ----------------------------------------------------------
//
// Declared under its own segment rather than `/requests/...` so it cannot be
// confused with a request id.
router.get(
  '/advances/outstanding',
  auth,
  requirePermission(PERMISSIONS.READ_TRAVEL),
  getOutstandingAdvances,
);

module.exports = router;
