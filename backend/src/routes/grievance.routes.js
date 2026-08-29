/**
 * @fileoverview Grievance Routes (POSH & Ethics Committee)
 * @description Handles both POSH complaints and general whistleblower reports.
 * POSH routes require ICC membership; Ethics routes use RBAC permissions.
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requireICC = require('../middlewares/iccAuth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  // POSH Controllers
  fileGrievance,
  getCases,
  decryptCase,
  recordICCVote,
  resolveGrievance,
  getSLADashboard,
  getEscalationStatus,
  extendInquiry,
  recordInterimRelief,
  validateCommittee,
  getCaseAgeingReport,
  // Ethics/Whistleblower Controllers
  submitAnonymous,
  getStatus,
  getCommitteeQueue,
  decryptReport,
  updateStatus,
} = require('../controllers/grievance.controller');

const router = express.Router();

// ============================================================================
// POSH Grievance Routes (ICC-only access)
// ============================================================================

// Public / Authenticated endpoint for filing
router.post('/posh/file', auth, fileGrievance);

// Strict ICC-only endpoints
router.get('/posh/cases', auth, requireICC, getCases);
router.get('/posh/sla-dashboard', auth, requireICC, getSLADashboard);

// --- Escalation, extension and composition (#1157) -------------------------
//
// The two literal-segment routes are declared before `/:id/...` so `committee`
// and `ageing-report` are not captured as a case id.
//
// All of them stay behind `requireICC` rather than `requirePermission`, for
// the anti-retaliation reason the whole router exists: the committee is
// deliberately not the same population as HR, and admins are locked out on
// purpose. That applies to the caseload report as much as to the case itself —
// an ageing report naming case numbers and their status is still case data.
router.get('/posh/committee/validate', auth, requireICC, validateCommittee);
router.get('/posh/ageing-report', auth, requireICC, getCaseAgeingReport);

router.post('/posh/:id/decrypt', auth, requireICC, decryptCase);
router.post('/posh/:id/vote', auth, requireICC, recordICCVote);
router.post('/posh/:id/resolve', auth, requireICC, resolveGrievance);

router.get('/posh/:id/escalation', auth, requireICC, getEscalationStatus);
router.post('/posh/:id/extend', auth, requireICC, extendInquiry);
router.post('/posh/:id/interim-relief', auth, requireICC, recordInterimRelief);

// ============================================================================
// Ethics Committee & Whistleblower Routes (RBAC-based access)
// ============================================================================

// Public anonymous endpoints (No auth middleware)
router.post('/ethics/submit', writeRateLimiter, submitAnonymous);
router.get('/ethics/status/:token', getStatus);

// Protected Ethics Committee endpoints
router.get('/ethics/committee', auth, requirePermission('READ_EMPLOYEE'), getCommitteeQueue);
router.get('/ethics/:id/decrypt', auth, requirePermission('READ_EMPLOYEE'), decryptReport);
router.patch('/ethics/:id/status', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, updateStatus);

module.exports = router;
