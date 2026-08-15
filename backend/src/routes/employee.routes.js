
const express = require("express");
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
  searchEmployees,
} = require("../controllers/employee.controller");

const auth = require("../middlewares/auth.middleware");
const { requireScope } = require("../middlewares/rbac.middleware");
const router = express.Router();

router.post("/", auth, requireScope("employee:write"), addEmployee);
router.get("/", auth, requireScope("employee:read"), getEmployees);
router.get("/recent", auth, requireScope("employee:read"), getRecentEmployees);

module.exports = router;
