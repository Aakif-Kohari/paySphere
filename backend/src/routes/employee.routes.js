const express = require("express");
const {
  addEmployee,
  getEmployees,
  getRecentEmployees,
  importEmployees,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
  restoreEmployee,
} = require("../controllers/employee.controller");

const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const upload = require("../middlewares/upload.middleware");
const {
  getSalaryStructure,
  getSalaryHistory,
  createSalaryRevision,
  previewSalaryStructure,
} = require("../controllers/salaryStructure.controller");

const { writeRateLimiter } = require("../middlewares/rateLimiter.middleware");

const router = express.Router();

router.post("/", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, addEmployee);
router.post("/import", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, upload.single("file"), importEmployees);
router.get("/", auth, requirePermission("READ_EMPLOYEE"), getEmployees);
router.get("/recent", auth, requirePermission("READ_EMPLOYEE"), getRecentEmployees);
router.delete("/:id", auth, requirePermission("DELETE_EMPLOYEE"), writeRateLimiter, deleteEmployee);
router.put("/:id", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, updateEmployee);
router.put("/:id/restore", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, restoreEmployee);
router.patch("/:id/status", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, toggleEmployeeStatus);

// --- Salary structure & revision history (#461) --------------------------
//
// Mounted on the employee router because they are per-employee resources and
// share its permissions: reading a package is reading an employee record,
// revising one changes what that employee is paid.
router.get(
  "/:id/salary-structure",
  auth,
  requirePermission("READ_EMPLOYEE"),
  getSalaryStructure,
);
router.get(
  "/:id/salary-history",
  auth,
  requirePermission("READ_EMPLOYEE"),
  getSalaryHistory,
);
// Preview writes nothing, so an admin can see the split and the delta before
// committing to a change that is append-only and cannot be edited away.
router.post(
  "/:id/salary-structure/preview",
  auth,
  requirePermission("READ_EMPLOYEE"),
  previewSalaryStructure,
);
router.post(
  "/:id/salary-revision",
  auth,
  requirePermission("WRITE_EMPLOYEE"),
  writeRateLimiter,
  createSalaryRevision,
);

module.exports = router;
