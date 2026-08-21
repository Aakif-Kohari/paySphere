const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { setAllocation, getAllocations, simulateAllocation, getAuditReport } = require('../controllers/matrixOrg.controller');

const router = express.Router();

router.post('/allocation', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, setAllocation);
router.get('/allocations', auth, requirePermission('READ_EMPLOYEE'), getAllocations);

router.post('/simulate', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, simulateAllocation);
router.get('/audit', auth, requirePermission('READ_PAYROLL'), getAuditReport);

module.exports = router;
