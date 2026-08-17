const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requireICC = require('../middlewares/iccAuth.middleware');
const {
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
} = require('../controllers/grievance.controller');

const router = express.Router();

// Public / Authenticated endpoint for filing
router.post('/file', auth, fileGrievance);

// Strict ICC-only endpoints
router.get('/cases', auth, requireICC, getCases);
router.get('/sla-dashboard', auth, requireICC, getSLADashboard);

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
router.get('/committee/validate', auth, requireICC, validateCommittee);
router.get('/ageing-report', auth, requireICC, getCaseAgeingReport);

router.post('/:id/decrypt', auth, requireICC, decryptCase);
router.post('/:id/vote', auth, requireICC, recordICCVote);
router.post('/:id/resolve', auth, requireICC, resolveGrievance);

router.get('/:id/escalation', auth, requireICC, getEscalationStatus);
router.post('/:id/extend', auth, requireICC, extendInquiry);
router.post('/:id/interim-relief', auth, requireICC, recordInterimRelief);

module.exports = router;
