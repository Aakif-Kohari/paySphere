/**
 * Travel routes — mounted at /api/travel (#1077, #1148, #1209).
 * @description Handles both original grade-based travel management and
 * simplified corporate travel & per diem workflows.
 */

const express = require('express');

const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  // Original Travel Controllers (Issue #1077)
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
  // Corporate Travel Controllers (Issue #1209)
  requestTravel,
  approveAdvance,
  submitSettlement,
  getMyTravel,
} = require('../controllers/travel.controller');

const router = express.Router();

// ============================================================================
// Original Travel Routes (Grade-based, Multi-leg - Issue #1077)
// ============================================================================

// --- Self-service ---------------------------------------------------------
router.get(
  '/original/my-trips',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_TRAVEL_REQUEST),
  getMyTrips,
);

// --- Executive Variance Reports -------------------------------------------
router.get(
  '/original/variance-report',
  auth,
  requirePermission(PERMISSIONS.READ_TRAVEL),
  getTravelVarianceReport,
);

// --- Policy ---------------------------------------------------------------
router.post(
  '/original/policies',
  auth,
  requirePermission(PERMISSIONS.MANAGE_TRAVEL_POLICY),
  writeRateLimiter,
  upsertPolicy,
);
router.get(
  '/original/policies',
  auth,
  requirePermission(PERMISSIONS.READ_TRAVEL),
  getPolicies,
);

// --- Requests -------------------------------------------------------------
router.post(
  '/original/requests',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_TRAVEL_REQUEST),
  writeRateLimiter,
  createRequest,
);
router.get(
  '/original/requests',
  auth,
  requirePermission(PERMISSIONS.READ_TRAVEL),
  getRequests,
);

// --- Approval and money ---------------------------------------------------
router.post(
  '/original/requests/:id/approve',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  approveRequest,
);
router.post(
  '/original/requests/:id/reject',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  rejectRequest,
);
router.post(
  '/original/requests/:id/advance',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  releaseAdvance,
);
router.post(
  '/original/requests/:id/settle',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  settleRequest,
);
router.post(
  '/original/requests/:id/multi-currency-settle',
  auth,
  requirePermission(PERMISSIONS.APPROVE_TRAVEL),
  writeRateLimiter,
  settleMultiCurrencyTrip,
);

// --- Receivables ----------------------------------------------------------
router.get(
  '/original/advances/outstanding',
  auth,
  requirePermission(PERMISSIONS.READ_TRAVEL),
  getOutstandingAdvances,
);

// ============================================================================
// Corporate Travel & Per Diem Routes (Simplified - Issue #1209)
// ============================================================================

// --- Public/Employee Routes ------------------------------------------------
router.get('/corporate/policies', auth, getPolicies);
router.post('/corporate/request', auth, writeRateLimiter, requestTravel);
router.get('/corporate/my-travel', auth, getMyTravel);

// --- Finance/Admin Routes --------------------------------------------------
router.patch(
  '/corporate/approve/:id',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  approveAdvance,
);
router.post(
  '/corporate/settle',
  auth,
  writeRateLimiter,
  submitSettlement,
);

module.exports = router;
