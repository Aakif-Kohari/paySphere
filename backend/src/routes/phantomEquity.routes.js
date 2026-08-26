const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createGrant, recordValuation, triggerSettlement, getMyGrants } = require('../controllers/phantomEquity.controller');

const router = express.Router();

router.get('/my-grants', auth, getMyGrants);

router.post('/grants', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createGrant);
router.post('/valuations', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, recordValuation);
router.post('/trigger-settlement', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, triggerSettlement);

module.exports = router;
