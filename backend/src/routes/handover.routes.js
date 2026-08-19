const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    initiateHandover, updateKnowledgeTransfer, updateAssetRecovery,
    revokeAccess, managerSignOff, getMyHandover, checkFnFEligibility
} = require('../controllers/handover.controller');

const router = express.Router();

router.post('/initiate', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, initiateHandover);
router.patch('/knowledge-transfer', auth, writeRateLimiter, updateKnowledgeTransfer);
router.patch('/asset-recovery', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, updateAssetRecovery);
router.patch('/revoke-access', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, revokeAccess);
router.post('/manager-signoff', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, managerSignOff);

router.get('/my-handover', auth, getMyHandover);
router.get('/fnf-eligibility/:employeeId', auth, requirePermission('WRITE_PAYROLL'), checkFnFEligibility);

module.exports = router;
