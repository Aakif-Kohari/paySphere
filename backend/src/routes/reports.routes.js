const express = require("express");
const { getAnalytics, downloadPDFReport, exportExcelReport, downloadPayslipsZip } = require("../controllers/reports.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const router = express.Router();

router.get("/analytics", auth, requirePermission("READ_REPORT"), getAnalytics);
router.get("/download-pdf", auth, requirePermission("READ_REPORT"), downloadPDFReport);

module.exports = router;

