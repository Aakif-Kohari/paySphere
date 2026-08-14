const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createTemplate,
  getRoster,
  assignShift,
  requestSwap,
  approveSwap,
} = require('../controllers/shiftRoster.controller');

const router = express.Router();

router.post(
  '/templates',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ROSTER),
  writeRateLimiter,
  createTemplate,
);
router.get(
  '/roster',
  auth,
  requirePermission(PERMISSIONS.READ_ROSTER),
  getRoster,
);
router.post(
  '/roster',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ROSTER),
  writeRateLimiter,
  assignShift,
);

// Swap Workflows
router.post(
  '/swap/request',
  auth,
  requirePermission(PERMISSIONS.READ_ROSTER),
  writeRateLimiter,
  requestSwap,
);
router.post(
  '/swap/:id/approve',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ROSTER),
  writeRateLimiter,
  approveSwap,
);

module.exports = router;
