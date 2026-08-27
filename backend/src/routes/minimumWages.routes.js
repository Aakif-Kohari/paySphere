const express = require('express');

const {
  listNotifications,
  createNotification,
  previewAssessment,
  commitAssessment,
  listAssessments,
  getAssessment,
  exportRegister,
  previewArrears,
} = require('../controllers/minimumWages.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Minimum Wages Act, 1948 (#1698) ---------------------------------------
//
// Three permissions rather than the usual two, because recording a notification
// and running an assessment against it are different authorities. A gazetted
// rate is a fact about the world that compliance staff transcribe; an
// assessment is a statement about what this employer owes. Letting whoever can
// type in a rate also commit the finding that measures the employer against it
// puts both halves of the check in one pair of hands.

// Declared before `/assessments/:id` so the literal segment is not captured.
router.get(
  '/notifications',
  auth,
  requirePermission(PERMISSIONS.READ_MINIMUM_WAGE),
  listNotifications,
);

router.post(
  '/notifications',
  auth,
  requirePermission(PERMISSIONS.MANAGE_MINIMUM_WAGE_SCHEDULE),
  writeRateLimiter,
  createNotification,
);

// What a retrospective revision costs for the periods already closed. A read of
// the assessments plus arithmetic — it writes nothing, so it sits with the
// schedule permission that owns the notification rather than with the
// assessment one.
router.post(
  '/notifications/:id/arrears',
  auth,
  requirePermission(PERMISSIONS.READ_MINIMUM_WAGE),
  previewArrears,
);

// Writes nothing. The CPI reading and the component mapping are both argued
// over before they settle, so a period gets assessed several times before one
// of those runs is committed.
router.post(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_MINIMUM_WAGE),
  previewAssessment,
);

router.get(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.READ_MINIMUM_WAGE),
  listAssessments,
);

router.post(
  '/assessments',
  auth,
  requirePermission(PERMISSIONS.RUN_MINIMUM_WAGE_ASSESSMENT),
  writeRateLimiter,
  commitAssessment,
);

router.get(
  '/assessments/:id',
  auth,
  requirePermission(PERMISSIONS.READ_MINIMUM_WAGE),
  getAssessment,
);

// Every employee's wage against the notified rate in one file. Sensitive, and
// still a read — it is the document an inspection asks for, so it stays with
// the read permission rather than becoming a fourth name.
router.get(
  '/assessments/:id/register',
  auth,
  requirePermission(PERMISSIONS.READ_MINIMUM_WAGE),
  exportRegister,
);

module.exports = router;
