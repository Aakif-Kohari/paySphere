const express = require("express");
const { finalizePayroll, getPayrollSummary, exportPayrollCSV, sendPayslipEmailHandler, sendAllPayslipsEmailHandler } = require("../controllers/payroll.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { writeRateLimiter } = require("../middlewares/rateLimiter.middleware");
const router = express.Router();

router.post("/finalize", auth, requirePermission("WRITE_PAYROLL"), writeRateLimiter, finalizePayroll);
router.get("/summary", auth, requirePermission("READ_PAYROLL"), getPayrollSummary);
router.get("/export-csv", auth, requirePermission("READ_REPORT"), exportPayrollCSV);
router.post("/send-email/:id", auth, requirePermission("WRITE_PAYROLL"), writeRateLimiter, sendPayslipEmailHandler);
router.post("/send-all-emails", auth, requirePermission("WRITE_PAYROLL"), writeRateLimiter, sendAllPayslipsEmailHandler);

module.exports = router;

