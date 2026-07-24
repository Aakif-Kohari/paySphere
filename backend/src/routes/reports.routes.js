const express = require("express");
const { getAnalytics, downloadPDFReport } = require("../controllers/reports.controller");
const auth = require("../middlewares/auth.middleware");
const router = express.Router();

router.get("/analytics", auth, getAnalytics);
router.get("/download-pdf", auth, downloadPDFReport);

module.exports = router;
