const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  getDepartments,
  getStats,
} = require('../controllers/stats.controller');

const router = express.Router();

router.get(
  '/departments',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getDepartments,
);

router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getStats,
);

module.exports = router;
