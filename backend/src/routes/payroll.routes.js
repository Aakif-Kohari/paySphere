const express = require("express");
const { finalizePayroll, getPayrollSummary, exportPayrollCSV, sendPayslipEmailHandler, sendAllPayslipsEmailHandler } = require("../controllers/payroll.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { writeRateLimiter } = require("../middlewares/rateLimiter.middleware");
const { PERMISSIONS } = require("../config/permissions");
const router = express.Router();

// These routes previously ran on `auth` alone: `requirePermission` was imported
// here but never applied, so finalizing payouts, exporting salary data and
// dispatching payslip emails were the only unguarded endpoints in the API while
// merely listing employees required a permission (#413).
router.post("/finalize", auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, finalizePayroll);
router.get("/summary", auth, requirePermission(PERMISSIONS.READ_PAYROLL), getPayrollSummary);
router.get("/export-csv", auth, requirePermission(PERMISSIONS.READ_PAYROLL), exportPayrollCSV);
router.post("/send-email/:id", auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, sendPayslipEmailHandler);
router.post("/send-all-emails", auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, sendAllPayslipsEmailHandler);

module.exports = router;
