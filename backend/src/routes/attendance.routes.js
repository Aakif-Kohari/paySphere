const express = require('express');
const {
  getAttendance,
  upsertAttendance,
  bulkMarkAttendance,
  getMonthSummary,
  getLeaveBalance,
} = require('../controllers/attendance.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// Attendance is the input to the salary calculation, so it is guarded with the
// same permissions as the employee records it belongs to: reading a ledger is
// reading an employee, writing one changes what that employee gets paid.

router.get('/', auth, requirePermission(PERMISSIONS.READ_EMPLOYEE), getAttendance);

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

// Declared last: `/summary`, `/balances` and `/bulk` are literal segments that
// would otherwise be captured by this route's `:employeeId` parameter.
router.put(
  '/:employeeId/:year/:month',
  auth,
  requirePermission(PERMISSIONS.WRITE_EMPLOYEE),
  writeRateLimiter,
  upsertAttendance,
);

module.exports = router;
