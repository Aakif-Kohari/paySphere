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
  getFixedAssetRegister,
  getOverdueReturns,
  impairAsset,
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

// --- Register reporting (#1156) --------------------------------------------
//
// Declared before `/:id/...` so the literal segments are not captured as an
// asset id — the same reason `/api/loans/summary` sits above `/api/loans/:id`.
router.get(
  '/register',
  auth,
  requirePermission(PERMISSIONS.READ_ASSET),
  getFixedAssetRegister,
);
router.get(
  '/overdue-returns',
  auth,
  requirePermission(PERMISSIONS.READ_ASSET),
  getOverdueReturns,
);

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

// Writing an asset down changes the company's reported net block, which is an
// accounting-period act rather than day-to-day asset admin. Gated on
// RUN_DEPRECIATION for the same reason the depreciation run is, and
// deliberately not on MANAGE_ASSET — that is what an HR coordinator holds to
// assign a laptop.
router.post(
  '/:id/impair',
  auth,
  requirePermission(PERMISSIONS.RUN_DEPRECIATION),
  writeRateLimiter,
  impairAsset,
);

// System / Cron
router.post(
  '/depreciate',
  auth,
  requirePermission(PERMISSIONS.RUN_DEPRECIATION),
  runMonthlyDepreciation,
);

module.exports = router;
