const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    registerDevice, ingestPunch, getLogs, triggerReconciliation
} = require('../controllers/biometric.controller');

const router = express.Router();

// HR Admin endpoints
router.post('/devices', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, registerDevice);
router.get('/logs', auth, requirePermission('READ_EMPLOYEE'), getLogs);
router.post('/reconcile', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, triggerReconciliation);

const { verifyBiometricPayload } = require('../middlewares/biometricSecurity');

// Device Webhook (Public/Rate Limited - verified via HMAC signature)
router.post('/webhook/punch', writeRateLimiter, verifyBiometricPayload, ingestPunch);

module.exports = router;
