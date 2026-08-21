const express = require('express');

const {
  previewReport,
  commitReport,
  listReports,
  getReport,
  getCompaRatios,
  listBands,
  upsertBand,
} = require('../controllers/payEquity.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Pay equity (#1347) ----------------------------------------------------
//
// Two permissions and a deliberate split between them, because the two halves
// of this feature are not equally sensitive.
//
// The compa-ratio analysis reads salary and salary bands and no protected
// characteristic whatsoever, so it sits behind READ_PAYROLL — the permission
// somebody already needs to see what anyone is paid. Putting it behind the
// demographic permission would hide the most useful and least sensitive query
// in the module from the people who should be running it weekly.
//
// The gap analysis reads declared gender, which is sensitive personal data. The
// population that should be running a pay gap analysis is much smaller than the
// population that can look up a phone number, and the access decision should
// say so rather than falling under READ_EMPLOYEE.

// Declared before `/reports/:id` so the literal segment is not captured.
router.get(
  '/compa-ratio',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getCompaRatios,
);

// Writes nothing. The suppression floor and the reference group are both worth
// varying before anything is committed, and a committed report is a published
// figure in several jurisdictions.
router.get(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_PAY_EQUITY),
  previewReport,
);

router.get(
  '/reports',
  auth,
  requirePermission(PERMISSIONS.READ_PAY_EQUITY),
  listReports,
);

router.post(
  '/reports',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PAY_EQUITY),
  writeRateLimiter,
  commitReport,
);

router.get(
  '/reports/:id',
  auth,
  requirePermission(PERMISSIONS.READ_PAY_EQUITY),
  getReport,
);

// --- Salary bands ----------------------------------------------------------
//
// Reading a band is reading payroll structure, so it carries READ_PAYROLL like
// the compa-ratio it feeds. Setting one is not: a band decides what everybody
// at that grade is checked against, so widening it is equivalent to approving
// any offer inside it — the same reasoning that keeps MANAGE_REQUISITION away
// from the recruiters who use it.

router.get(
  '/bands',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  listBands,
);

router.put(
  '/bands/:jobLevel',
  auth,
  requirePermission(PERMISSIONS.MANAGE_PAY_EQUITY),
  writeRateLimiter,
  upsertBand,
);

module.exports = router;
