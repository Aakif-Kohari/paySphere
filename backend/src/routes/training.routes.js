/**
 * Training routes — mounted at /api/training (#1076, #1085).
 *
 * Permissions:
 *
 *   - READ_TRAINING          the catalogue, and the compliance reports
 *   - MANAGE_TRAINING        create courses, assign them, record completions
 *                            and waive obligations. HR's job.
 *   - COMPLETE_OWN_TRAINING  an employee looking at their own record
 *   - WRITE_EMPLOYEE         alternative course/assignment creation (#1085)
 *   - READ_EMPLOYEE          dashboard statistics (#1085)
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
  uploadCertificate,
  getMyTraining,
  getDashboardStats,
  getComplianceGaps,
  getComplianceSummary,
  getRenewalsDue,
} = require('../controllers/training.controller');

const router = express.Router();

// --- Self-service ---------------------------------------------------------
//
// Declared first so it cannot be shadowed by any `/:id` pattern. `getMyTraining`
// resolves the employee from `req.userId`, so the route carries no identifier a
// caller could substitute. No explicit permission required — ownership is
// enforced inside the controller via req.userId (#1085 simplification).
router.get('/my-training', auth, getMyTraining);

// --- Dashboard ------------------------------------------------------------
//
// Static path declared before any `/:id` routes to prevent shadowing.
router.get(
  '/dashboard/stats',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getDashboardStats,
);

// --- Certificate Upload ---------------------------------------------------
//
// Manual certificate proof upload with auto-verification (#1085).
// No specific permission beyond auth — the controller validates tenant
// ownership of the record being updated.
router.post('/certificates', auth, writeRateLimiter, uploadCertificate);

// --- Courses --------------------------------------------------------------
//
// Both legacy (/courses) and body-style (/assign) assignment patterns are
// supported. The controller handles both URL-param and body-based courseId.
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

// Body-style assignment (#1085): { courseId, employeeIds }
// Uses WRITE_EMPLOYEE as an alternative to MANAGE_TRAINING for systems
// that integrate training assignment into broader employee management flows.
router.post(
  '/assign',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
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
