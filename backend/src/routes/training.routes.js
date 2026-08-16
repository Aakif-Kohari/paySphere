/**
 * Training routes — mounted at /api/training (#1076).
 *
 * Three permissions:
 *
 *   - READ_TRAINING          the catalogue, and the compliance reports
 *   - MANAGE_TRAINING        create courses, assign them, record completions
 *                            and waive obligations. HR's job.
 *   - COMPLETE_OWN_TRAINING  an employee looking at their own record
 *
 * `MANAGE_TRAINING` stays with HR rather than moving to the owner, unlike most
 * of the write permissions added recently. Assigning fire-safety training is
 * administrative; it commits no budget and moves no money. The one action in
 * here with real weight is the waiver — exempting somebody from mandatory
 * training — and that is bounded by the endpoint requiring a written reason
 * rather than by holding it back to the owner, because in practice HR is who
 * makes and defends that call.
 */

const express = require('express');

const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  createCourse,
  getCourses,
  updateCourse,
  assignCourse,
  completeEnrollment,
  waiveEnrollment,
  getMyTraining,
  getComplianceGaps,
  getComplianceSummary,
  getRenewalsDue,
} = require('../controllers/training.controller');

const router = express.Router();

// --- Self-service ---------------------------------------------------------
//
// Declared first so it cannot be shadowed by any `/:id` pattern. `getMyTraining`
// resolves the employee from `req.userId`, so the route carries no identifier a
// caller could substitute.
router.get(
  '/my-training',
  auth,
  requirePermission(PERMISSIONS.COMPLETE_OWN_TRAINING),
  getMyTraining,
);

// --- Courses --------------------------------------------------------------
router.post(
  '/courses',
  auth,
  requirePermission(PERMISSIONS.MANAGE_TRAINING),
  writeRateLimiter,
  createCourse,
);
router.get(
  '/courses',
  auth,
  requirePermission(PERMISSIONS.READ_TRAINING),
  getCourses,
);
router.patch(
  '/courses/:id',
  auth,
  requirePermission(PERMISSIONS.MANAGE_TRAINING),
  writeRateLimiter,
  updateCourse,
);
router.post(
  '/courses/:id/assign',
  auth,
  requirePermission(PERMISSIONS.MANAGE_TRAINING),
  writeRateLimiter,
  assignCourse,
);

// --- Enrolments -----------------------------------------------------------
router.post(
  '/enrollments/:id/complete',
  auth,
  requirePermission(PERMISSIONS.MANAGE_TRAINING),
  writeRateLimiter,
  completeEnrollment,
);
router.post(
  '/enrollments/:id/waive',
  auth,
  requirePermission(PERMISSIONS.MANAGE_TRAINING),
  writeRateLimiter,
  waiveEnrollment,
);

// --- Compliance reporting -------------------------------------------------
//
// The reason the whole feature exists. `/gaps` answers "which employees in
// Engineering are missing mandatory POSH training", which is the question an
// auditor asks first.
router.get(
  '/compliance/gaps',
  auth,
  requirePermission(PERMISSIONS.READ_TRAINING),
  getComplianceGaps,
);
router.get(
  '/compliance/summary',
  auth,
  requirePermission(PERMISSIONS.READ_TRAINING),
  getComplianceSummary,
);
router.get(
  '/compliance/renewals',
  auth,
  requirePermission(PERMISSIONS.READ_TRAINING),
  getRenewalsDue,
);

module.exports = router;
