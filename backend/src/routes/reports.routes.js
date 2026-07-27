const express = require("express");
const { getAnalytics, downloadPDFReport, exportExcelReport, downloadPayslipsZip } = require("../controllers/reports.controller");
const auth = require("../middlewares/auth.middleware");
const router = express.Router();

router.get("/analytics", auth, getAnalytics);
router.get("/download-pdf", auth, downloadPDFReport);
router.get("/export-xlsx", auth, exportExcelReport);
router.get("/download-zip", auth, downloadPayslipsZip);

module.exports = router;

