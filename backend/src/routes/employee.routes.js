const express = require("express");
const {
  addEmployee,
  getEmployees,
  getRecentEmployees,
  importEmployees,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
} = require("../controllers/employee.controller");

const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const upload = require("../middlewares/upload.middleware");

const { writeRateLimiter } = require("../middlewares/rateLimiter.middleware");

const router = express.Router();

router.post("/", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, addEmployee);
router.post("/import", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, upload.single("file"), importEmployees);
router.get("/", auth, requirePermission("READ_EMPLOYEE"), getEmployees);
router.get("/recent", auth, requirePermission("READ_EMPLOYEE"), getRecentEmployees);
router.delete("/:id", auth, requirePermission("DELETE_EMPLOYEE"), writeRateLimiter, deleteEmployee);
router.put("/:id", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, updateEmployee);
router.patch("/:id/status", auth, requirePermission("WRITE_EMPLOYEE"), writeRateLimiter, toggleEmployeeStatus);

module.exports = router;
