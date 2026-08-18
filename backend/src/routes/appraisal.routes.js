const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createCycle,
  upsertGoals,
  submitSelfReview,
  submitManagerReview,
  getMyReview,
  getCycleDistribution,
  previewCalibration,
  calibrateCycle,
} = require('../controllers/appraisal.controller');

const router = express.Router();

router.post(
  '/cycles',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRAISAL),
  writeRateLimiter,
  createCycle,
);
router.post(
  '/goals',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRAISAL),
  writeRateLimiter,
  upsertGoals,
);
router.get(
  '/my-review',
  auth,
  requirePermission(PERMISSIONS.READ_OWN_APPRAISAL),
  getMyReview,
);

router.patch(
  '/reviews/:id/self-review',
  auth,
  requirePermission(PERMISSIONS.READ_OWN_APPRAISAL),
  writeRateLimiter,
  submitSelfReview,
);
router.patch(
  '/reviews/:id/manager-review',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRAISAL),
  writeRateLimiter,
  submitManagerReview,
);

// --- Cohort calibration (#1158) --------------------------------------------
//
// All three carry MANAGE_APPRAISAL rather than READ_OWN_APPRAISAL. These are
// company-wide reads and writes: the distribution report exposes every
// manager's leniency and every employee's rank in the cycle, which is not a
// thing an employee looking at their own review is entitled to see.

router.get(
  '/cycles/:id/distribution',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRAISAL),
  getCycleDistribution,
);

// A POST that writes nothing — it takes calibration parameters in the body and
// is far too large for a query string. Kept off the write rate limiter for the
// same reason `/api/loans/preview` is: modelling an outcome is not a write.
router.post(
  '/cycles/:id/normalize',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRAISAL),
  previewCalibration,
);

router.post(
  '/cycles/:id/calibrate',
  auth,
  requirePermission(PERMISSIONS.MANAGE_APPRAISAL),
  writeRateLimiter,
  calibrateCycle,
);

module.exports = router;
