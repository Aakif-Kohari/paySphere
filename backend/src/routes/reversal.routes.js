const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { initiateReversal, getReversals, approveReversal, checkPayrollBlockGuard } = require('../controllers/reversal.controller');

const router = express.Router();

router.post('/initiate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, initiateReversal);
router.get('/', auth, requirePermission('READ_PAYROLL'), getReversals);
router.patch('/:id/approve', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, approveReversal);
router.get('/block-guard', auth, requirePermission('WRITE_PAYROLL'), checkPayrollBlockGuard);

module.exports = router;
