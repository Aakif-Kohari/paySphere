const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createRule, getRules, assignOnCall, calculateMonthlyAllowances, getAuditBatch, approveBatch } = require('../controllers/shiftAllowance.controller');

const router = express.Router();

router.post('/rules', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createRule);
router.get('/rules', auth, requirePermission('READ_PAYROLL'), getRules);
router.post('/on-call', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, assignOnCall);

router.post('/calculate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, calculateMonthlyAllowances);
router.get('/audit', auth, requirePermission('READ_PAYROLL'), getAuditBatch);
router.post('/approve', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, approveBatch);

module.exports = router;
