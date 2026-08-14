const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createCategory,
  createAsset,
  getAssets,
  assignAsset,
  returnAsset,
  runMonthlyDepreciation,
  getDepreciationSchedule,
  disposeAsset,
} = require('../controllers/asset.controller');

const router = express.Router();

// Categories
router.post(
  '/categories',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ASSET),
  writeRateLimiter,
  createCategory,
);

// Assets CRUD
router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ASSET),
  writeRateLimiter,
  createAsset,
);
router.get('/', auth, requirePermission(PERMISSIONS.READ_ASSET), getAssets);

// Workflows & Schedules
router.get(
  '/:id/schedule',
  auth,
  requirePermission(PERMISSIONS.READ_ASSET),
  getDepreciationSchedule,
);
router.post(
  '/:id/assign',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ASSET),
  writeRateLimiter,
  assignAsset,
);
router.post(
  '/:id/return',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ASSET),
  writeRateLimiter,
  returnAsset,
);
router.post(
  '/:id/dispose',
  auth,
  requirePermission(PERMISSIONS.MANAGE_ASSET),
  writeRateLimiter,
  disposeAsset,
);

// System / Cron
router.post(
  '/depreciate',
  auth,
  requirePermission(PERMISSIONS.RUN_DEPRECIATION),
  runMonthlyDepreciation,
);

module.exports = router;
