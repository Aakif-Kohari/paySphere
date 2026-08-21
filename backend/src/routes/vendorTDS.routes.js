const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { addVendor, logPayment, generateForm26Q, getVendors, getLedger } = require('../controllers/vendorTDS.controller');

const router = express.Router();

router.post('/vendors', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, addVendor);
router.get('/vendors', auth, requirePermission('READ_PAYROLL'), getVendors);

router.post('/ledger', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, logPayment);
router.get('/ledger', auth, requirePermission('READ_PAYROLL'), getLedger);

router.post('/form26q/generate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateForm26Q);

module.exports = router;
