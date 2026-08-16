/**
 * Recruitment routes — mounted at /api/recruitment (#1074).
 *
 * Four permissions, split along the lines that actually differ:
 *
 *   - READ_REQUISITION          see open roles, their bands and their fill state
 *   - MANAGE_REQUISITION        open a role, and amend the approved CTC band.
 *                               Owner only: a requisition commits headcount
 *                               budget, and the band is what an offer is checked
 *                               against — so being able to widen it is being
 *                               able to approve any offer.
 *   - MANAGE_CANDIDATE          run the pipeline. HR's day job.
 *   - SUBMIT_INTERVIEW_FEEDBACK write a scorecard. Held by anyone who interviews,
 *                               which is not the same population as HR.
 *
 * The band split is the one worth defending. `updateCandidateStage` refuses an
 * offer above the approved band outright rather than accepting an override flag
 * in the body, so exceeding a band means amending the requisition — an explicit,
 * audited act by whoever holds MANAGE_REQUISITION. An override boolean would put
 * that authority in the hands of whoever can move a candidate.
 */

const express = require('express');

const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  createRequisition,
  getRequisitions,
  updateRequisitionStatus,
  createCandidate,
  getCandidates,
  updateCandidateStage,
  submitFeedback,
  getScorecard,
  getFunnelAnalytics,
} = require('../controllers/recruitment.controller');

const router = express.Router();

// --- Requisitions ---------------------------------------------------------
router.post(
  '/requisitions',
  auth,
  requirePermission(PERMISSIONS.MANAGE_REQUISITION),
  writeRateLimiter,
  createRequisition,
);
router.get(
  '/requisitions',
  auth,
  requirePermission(PERMISSIONS.READ_REQUISITION),
  getRequisitions,
);
router.patch(
  '/requisitions/:id/status',
  auth,
  requirePermission(PERMISSIONS.MANAGE_REQUISITION),
  writeRateLimiter,
  updateRequisitionStatus,
);

// --- Candidates -----------------------------------------------------------
router.post(
  '/candidates',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CANDIDATE),
  writeRateLimiter,
  createCandidate,
);
router.get(
  '/candidates',
  auth,
  requirePermission(PERMISSIONS.READ_REQUISITION),
  getCandidates,
);
router.patch(
  '/candidates/:id/stage',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CANDIDATE),
  writeRateLimiter,
  updateCandidateStage,
);

// --- Interview feedback ---------------------------------------------------
//
// Gated on its own permission because interviewers are not recruiters. The
// interviewer is taken from `req.userId` rather than from the body, so holding
// this does not let one person file feedback under another's name.
router.post(
  '/candidates/:id/feedback',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_INTERVIEW_FEEDBACK),
  writeRateLimiter,
  submitFeedback,
);
router.get(
  '/candidates/:id/scorecard',
  auth,
  requirePermission(PERMISSIONS.READ_REQUISITION),
  getScorecard,
);

// --- Analytics ------------------------------------------------------------
router.get(
  '/analytics/funnel',
  auth,
  requirePermission(PERMISSIONS.READ_REQUISITION),
  getFunnelAnalytics,
);

module.exports = router;
