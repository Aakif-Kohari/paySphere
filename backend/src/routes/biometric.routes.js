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

// Device Webhook (Public/Rate Limited - in prod, use API key middleware)
router.post('/webhook/punch', writeRateLimiter, ingestPunch);

module.exports = router;
