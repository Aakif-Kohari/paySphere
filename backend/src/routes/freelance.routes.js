const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createContract, fundEscrow, approveMilestone, getContracts, getLedger } = require('../controllers/freelance.controller');

const router = express.Router();

router.post('/contracts', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createContract);
router.get('/contracts', auth, requirePermission('READ_PAYROLL'), getContracts);

router.post('/escrow/fund', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, fundEscrow);
router.post('/milestones/approve', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, approveMilestone);

router.get('/ledger/:contractId', auth, requirePermission('READ_PAYROLL'), getLedger);

module.exports = router;
