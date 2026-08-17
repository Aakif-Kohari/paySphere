const express = require("express");
const { getEmployeeProfile, getMyPayslips } = require("../controllers/employeePortal.controller");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/rbac.middleware");

const router = express.Router();

router.get("/profile", auth, authorize("EMPLOYEE", "ADMIN"), getEmployeeProfile);
router.get("/payslips", auth, authorize("EMPLOYEE", "ADMIN"), getMyPayslips);

module.exports = router;
