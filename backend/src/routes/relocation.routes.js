const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createRequest, submitExpense, calculateGrossUps, injectToPayroll, getMyRequests } = require('../controllers/relocation.controller');

const router = express.Router();

router.post('/request', auth, writeRateLimiter, createRequest);
router.post('/expense', auth, writeRateLimiter, submitExpense);
router.get('/my-requests', auth, getMyRequests);

router.post('/calculate-grossup/:requestId', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, calculateGrossUps);
router.post('/inject-payroll/:requestId', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, injectToPayroll);

module.exports = router;
