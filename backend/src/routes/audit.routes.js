const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const { getAuditLogs, exportAuditLogsCSV } = require("../controllers/audit.controller");

router.get("/export", auth, exportAuditLogsCSV);
router.get("/", auth, getAuditLogs);

module.exports = router;
