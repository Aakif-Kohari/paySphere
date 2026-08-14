const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  createPYQ,
  bulkUploadPYQs,
  getPYQs,
  generateTrendForecast,
  getLatestTrendForecast,
} = require('../controllers/pyq.controller');

/**
 * Previous-year questions and trend forecasting.
 *
 * Every route here applied `auth` and nothing else (#1011) — the only router in
 * the tree with no permission gate anywhere on it. Any authenticated account,
 * of any account type, could bulk-upload into the question bank and trigger
 * forecast generation. `auth` answers "who are you"; it never answers "may
 * you".
 *
 * The split is the usual one: reading the bank is something every role does,
 * writing to it is not.
 *
 * The three write routes also pick up `writeRateLimiter`, which every other
 * write route in the product has and these did not. A bulk upload and an AI
 * trend forecast are both expensive enough that an unthrottled loop is a
 * denial-of-service against the tenant's own data.
 */

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PYQ),
  writeRateLimiter,
  createPYQ,
);
router.post(
  '/bulk',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PYQ),
  writeRateLimiter,
  bulkUploadPYQs,
);
router.get('/', auth, requirePermission(PERMISSIONS.READ_PYQ), getPYQs);
router.post(
  '/forecast',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PYQ),
  writeRateLimiter,
  generateTrendForecast,
);
router.get(
  '/forecast',
  auth,
  requirePermission(PERMISSIONS.READ_PYQ),
  getLatestTrendForecast,
);

module.exports = router;
