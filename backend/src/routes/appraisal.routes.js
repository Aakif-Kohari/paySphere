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

module.exports = router;
