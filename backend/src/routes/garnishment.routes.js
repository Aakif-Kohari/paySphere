const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createOrder, getActiveOrders, processPayrollInterceptor, recordRemittance, generateRemittanceReport } = require('../controllers/garnishment.controller');

const router = express.Router();

router.post('/orders', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createOrder);
router.get('/orders', auth, requirePermission('READ_PAYROLL'), getActiveOrders);

router.post('/process-payroll', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processPayrollInterceptor);
router.post('/remit', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, recordRemittance);

router.get('/report', auth, requirePermission('READ_PAYROLL'), generateRemittanceReport);

module.exports = router;
