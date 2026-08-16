const express = require("express");
const { finalizePayroll, getPayrollSummary } = require("../controllers/payroll.controller");
const auth = require("../middlewares/auth.middleware");
const { requireScope } = require("../middlewares/rbac.middleware");
const router = express.Router();

router.post("/finalize", auth, requireScope("payroll:write"), finalizePayroll);
router.get("/summary", auth, requireScope("payroll:read"), getPayrollSummary);

module.exports = router;
