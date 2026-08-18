const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { generateECR, uploadPaymentReceipt, getVaultHistory } = require('../controllers/statutory.controller');

const router = express.Router();

router.post('/generate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateECR);
router.post('/upload-receipt', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, uploadPaymentReceipt);
router.get('/vault', auth, requirePermission('READ_PAYROLL'), getVaultHistory);

module.exports = router;
