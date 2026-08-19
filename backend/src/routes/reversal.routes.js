const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { initiateReversal, getReversals, approveReversal, checkPayrollBlockGuard } = require('../controllers/reversal.controller');
const { requireMFA } = require('../middlewares/mfa.middleware');

const router = express.Router();

router.post('/initiate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, requireMFA, initiateReversal);
router.get('/', auth, requirePermission('READ_PAYROLL'), getReversals);
router.patch('/:id/approve', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, requireMFA, approveReversal);
router.get('/block-guard', auth, requirePermission('WRITE_PAYROLL'), checkPayrollBlockGuard);

module.exports = router;
