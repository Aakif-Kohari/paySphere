const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  getClosurePolicies,
  previewClosure,
  runClosure,
  getClosureHistory,
  getClosureSummary,
} = require('../controllers/leaveClosure.controller');

const router = express.Router();

router.get(
  '/policies',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getClosurePolicies,
);

router.get(
  '/summary',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getClosureSummary,
);

router.get(
  '/history',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getClosureHistory,
);

router.post(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  previewClosure,
);

router.post(
  '/run',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  runClosure,
);

module.exports = router;
