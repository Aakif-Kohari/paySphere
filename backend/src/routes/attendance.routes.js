const express = require('express');
const {
  getAttendance,
  upsertAttendance,
  bulkMarkAttendance,
  getMonthSummary,
  getLeaveBalance,
} = require('../controllers/attendance.controller');
const {
  clockIn,
  clockOut,
  getClockStatus,
  listOfficeLocations,
  createOfficeLocation,
  updateOfficeLocation,
  deleteOfficeLocation,
} = require('../controllers/attendanceClock.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// Attendance is the input to the salary calculation, so it is guarded with the
// same permissions as the employee records it belongs to: reading a ledger is
// reading an employee, writing one changes what that employee gets paid.

router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getAttendance,
);

router.get(
  '/summary',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getMonthSummary,
);

router.get(
  '/balances',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getLeaveBalance,
);

router.post(
  '/bulk',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  bulkMarkAttendance,
);

// --- Clocking in and out (#930, reachable since #953) ---------------------
//
// Gated on READ_EMPLOYEE rather than WRITE_EMPLOYEE, which is the one place in
// this router the two come apart. A punch is a statement about where somebody
// is, made by that person; the grid edit above is a manager deciding what a day
// is worth in payroll. Requiring the write permission would mean an employee
// could not clock themselves in, which is the entire feature.

router.post(
  '/clock-in',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  writeRateLimiter,
  clockIn,
);

router.post(
  '/clock-out',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  writeRateLimiter,
  clockOut,
);

router.get(
  '/clock-status',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getClockStatus,
);

// --- Office locations -----------------------------------------------------
//
// Writing one takes WRITE_EMPLOYEE: deciding where staff may clock in from
// decides whose attendance is recorded as field duty, which reaches payroll.

router.get(
  '/office-locations',
  auth,
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  listOfficeLocations,
);

router.post(
  '/office-locations',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  createOfficeLocation,
);

router.patch(
  '/office-locations/:id',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  updateOfficeLocation,
);

router.delete(
  '/office-locations/:id',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  deleteOfficeLocation,
);

// Declared last: `/summary`, `/balances`, `/bulk`, `/clock-*` and
// `/office-locations` are literal segments that would otherwise be captured by
// this route's `:employeeId` parameter.
router.put(
  '/:employeeId/:year/:month',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  upsertAttendance,
);

module.exports = router;
