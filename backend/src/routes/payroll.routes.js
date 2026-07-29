const express = require("express");
const { finalizePayroll, getPayrollStatus, getPayrollSummary, exportPayrollCSV, sendPayslipEmailHandler, sendAllPayslipsEmailHandler } = require("../controllers/payroll.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { writeRateLimiter } = require("../middlewares/rateLimiter.middleware");
const router = express.Router();

router.get("/status/:jobId", auth, getPayrollStatus);
router.post("/finalize", auth, writeRateLimiter, finalizePayroll);
router.get("/summary", auth, getPayrollSummary);
router.get("/export-csv", auth, exportPayrollCSV);
router.post("/send-email/:id", auth, writeRateLimiter, sendPayslipEmailHandler);
router.post("/send-all-emails", auth, writeRateLimiter, sendAllPayslipsEmailHandler);

module.exports = router;

