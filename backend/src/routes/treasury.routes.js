const express = require('express');
const { getVaults, executeSwap, getRebalanceLogs } = require('../controllers/treasury.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.get('/vaults', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getVaults);
router.post('/swap', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, executeSwap);
router.get('/rebalance-logs', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getRebalanceLogs);

module.exports = router;
