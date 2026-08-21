const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createPolicy, getPolicies, getEmployeePensionSetting, updateEmployeePensionSetting } = require('../controllers/pension.controller');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.post('/policies', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, createPolicy);
router.get('/policies', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getPolicies);

router.get('/settings/:employeeId', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getEmployeePensionSetting);
router.post('/settings/:employeeId', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, updateEmployeePensionSetting);

module.exports = router;
