const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createAdjustment, getAdjustments } = require('../controllers/salaryAdjustment.controller');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.post('/', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, createAdjustment);
router.get('/', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getAdjustments);

module.exports = router;
