const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    createMaskingRule, recordConsent, requestErasure,
    processErasure, getMaskedEmployeeData, getDashboard
} = require('../controllers/dataPrivacy.controller');

const router = express.Router();

router.post('/rules', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createMaskingRule);
router.post('/consent', auth, writeRateLimiter, recordConsent);

router.post('/erasure/request', auth, writeRateLimiter, requestErasure);
router.post('/erasure/process', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, processErasure);

router.get('/employee/:employeeId', auth, getMaskedEmployeeData);
router.get('/dashboard', auth, requirePermission('READ_EMPLOYEE'), getDashboard);

module.exports = router;
