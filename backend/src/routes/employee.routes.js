const express = require("express");
const {
  addEmployee,
  getEmployees,
  getRecentEmployees,
  getOrgChart,
  updateEmployeeManager,
} = require("../controllers/employee.controller");
const auth = require("../middlewares/auth.middleware");
const { requireScope } = require("../middlewares/rbac.middleware");
const { validateRequest } = require("../middlewares/validate.middleware");
const { employeeSchema } = require("../validations/schemas");
const router = express.Router();

router.post("/", auth, requireScope("employee:write"), validateRequest(employeeSchema), addEmployee);
router.get("/", auth, requireScope("employee:read"), getEmployees);
router.get("/recent", auth, requireScope("employee:read"), getRecentEmployees);
router.get("/org-chart", auth, requireScope("employee:read"), getOrgChart);
router.patch("/:id/manager", auth, requireScope("employee:write"), updateEmployeeManager);

module.exports = router;