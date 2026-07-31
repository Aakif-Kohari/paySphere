const express = require("express");
const { getAnalytics, downloadPDFReport, exportExcelReport, downloadPayslipsZip } = require("../controllers/reports.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const router = express.Router();

router.get("/analytics", auth, requirePermission("READ_REPORT"), getAnalytics);
router.get("/download-pdf", auth, requirePermission("READ_REPORT"), downloadPDFReport);

// `exportExcelReport` and `downloadPayslipsZip` were implemented in full for
// #334 and imported here, but no route was ever registered — so both endpoints
// 404'd and the feature was unreachable dead code shipping `exceljs` and
// `archiver` in every deployment (#415).
router.get("/export-xlsx", auth, requirePermission("READ_REPORT"), exportExcelReport);
router.get("/download-zip", auth, requirePermission("READ_REPORT"), downloadPayslipsZip);

module.exports = router;
