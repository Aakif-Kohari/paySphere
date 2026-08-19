const express = require('express');
const multer = require('multer');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { generateECR, uploadPaymentReceipt, getVaultHistory } = require('../controllers/statutory.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

router.post('/generate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateECR);
router.post('/upload-receipt', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, upload.single('receipt'), uploadPaymentReceipt);
router.get('/vault', auth, requirePermission('READ_PAYROLL'), getVaultHistory);

module.exports = router;
