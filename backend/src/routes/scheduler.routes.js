const express = require("express");
const { createSchedule, getSchedules, deleteSchedule } = require("../controllers/scheduler.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const router = express.Router();

router.post("/", auth, requirePermission("READ_REPORT"), createSchedule);
router.get("/", auth, requirePermission("READ_REPORT"), getSchedules);
router.delete("/:id", auth, requirePermission("READ_REPORT"), deleteSchedule);

module.exports = router;
