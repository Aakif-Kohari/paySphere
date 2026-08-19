const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { getDepartments } = require('../controllers/stats.controller');

const router = express.Router();

router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getDepartments,
);

module.exports = router;
