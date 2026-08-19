const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    getActivePrograms, submitReferral, getMyReferrals,
    updateCandidateStatus, runPayoutEngine, getAdminPipeline
} = require('../controllers/referral.controller');

const router = express.Router();

router.get('/programs', auth, getActivePrograms);
router.post('/submit', auth, writeRateLimiter, submitReferral);
router.get('/my-referrals', auth, getMyReferrals);

// HR/Admin Routes
router.get('/pipeline', auth, requirePermission('WRITE_EMPLOYEE'), getAdminPipeline);
router.patch('/candidates/:id/status', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, updateCandidateStatus);
router.post('/process-payouts', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, runPayoutEngine);

module.exports = router;
