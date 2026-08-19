const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { getConfig, updateConfig, getMyBalance, giveKudos, getFeed, redeemKudos } = require('../controllers/recognition.controller');

const router = express.Router();

router.get('/config', auth, requirePermission('READ_EMPLOYEE'), getConfig);
router.post('/config', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, updateConfig);

router.get('/balance', auth, getMyBalance);
router.post('/give', auth, writeRateLimiter, giveKudos);
router.post('/redeem', auth, writeRateLimiter, redeemKudos);
router.get('/feed', auth, getFeed);

module.exports = router;
