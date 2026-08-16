/**
 * Employee routes.
 *
 * Restored in #1078, for the same reason as `payroll.routes.js` next door:
 * #1057's branch was cut from a base predating most of this file, and its merge
 * replaced a 69-line router with a 24-line one. Seven endpoints left the route
 * table —
 *
 *     POST   /import              PUT    /:id/restore
 *     GET    /export-csv          PATCH  /:id/status
 *     PUT    /:id                 DELETE /:id
 *
 * — along with the four salary-structure routes #461 added. The three that
 * survived were rewritten onto `requireScope`, which is a static table that
 * consults no database and is therefore invisible to the custom-role feature
 * (#475): a bespoke role composed at /api/roles had no bearing on who could
 * create an employee.
 *
 * What makes this one quieter than the payroll router is that nothing threw.
 * Every remaining handler was a real function, so the app booted (once
 * `requirePermission` was back) and simply answered 404 for CSV import, CSV
 * export, edit, delete, deactivate, restore, and every salary-revision call the
 * frontend makes. That is the #792 failure mode exactly: routes do not vanish
 * loudly.
 *
 * Permissions are named through `PERMISSIONS` rather than as string literals.
 * The literals were what let #794 and #951 happen — a typo in one is just a
 * string, so a misspelt permission name denies every caller in the product,
 * owner included, and nothing anywhere says why.
 *
 * (This paragraph deliberately does not quote the misspelling inside a guard
 * call. `permissions.expense.test.js` scans this file as raw text without
 * stripping comments, so an illustrative example reads to it as a real route
 * asking for a permission that does not exist — the same false positive
 * `permissions.routeCoverage.test.js` documents in its own header.)
 */

const express = require('express');
const {
  addEmployee,
  getEmployees,
  getRecentEmployees,
  importEmployees,
  exportEmployeesCSV,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
  restoreEmployee,
} = require('../controllers/employee.controller');
const {
  getSalaryStructure,
  getSalaryHistory,
  createSalaryRevision,
  previewSalaryStructure,
} = require('../controllers/salaryStructure.controller');

const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const upload = require('../middlewares/upload.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Directory ------------------------------------------------------------
//
// `searchEmployees` is deliberately not mounted here. It is served from
// `search.routes.js` at /api/search, and the pre-#1057 version of this file
// imported it without ever using it.

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  addEmployee,
);
router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getEmployees,
);
router.get(
  '/recent',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getRecentEmployees,
);

// --- Bulk import / export -------------------------------------------------
//
// `/export-csv` is declared before the `/:id` routes below: a literal segment
// and a parameter at the same depth are matched in declaration order, so the
// other way round `updateEmployee` would receive `id: 'export-csv'`.
router.post(
  '/import',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  upload.single('file'),
  importEmployees,
);
router.get(
  '/export-csv',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  exportEmployeesCSV,
);

// --- Record lifecycle -----------------------------------------------------
//
// DELETE_EMPLOYEE is separate from WRITE_EMPLOYEE because they are not the same
// act: editing a phone number and destroying an employee's payroll history sit
// at different levels of authority, and the HR manager role holds only the
// first (#413).
router.put(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  updateEmployee,
);
router.delete(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.DELETE_EMPLOYEE),
  writeRateLimiter,
  deleteEmployee,
);
router.put(
  '/:id/restore',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  restoreEmployee,
);
router.patch(
  '/:id/status',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  toggleEmployeeStatus,
);

// --- Salary structure & revision history (#461) --------------------------
router.get(
  '/:id/salary-structure',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getSalaryStructure,
);
router.get(
  '/:id/salary-history',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getSalaryHistory,
);
router.post(
  '/:id/salary-structure/preview',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  previewSalaryStructure,
);
router.post(
  '/:id/salary-revision',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  createSalaryRevision,
);

module.exports = router;
