const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const { getAuditLogs } = require("../controllers/audit.controller");

router.get("/", auth, getAuditLogs);

module.exports = router;
