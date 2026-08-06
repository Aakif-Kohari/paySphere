const express = require("express");
const { createSchedule, getSchedules, deleteSchedule } = require("../controllers/scheduler.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../config/permissions");
const router = express.Router();

/**
 * All three routes used to require READ_REPORT (#666).
 *
 * Every role holds READ_REPORT, Employee included, so anyone who could open the
 * Reports page could also create a schedule that mails a payroll register to an
 * address of their choosing on a recurring basis — or delete an administrator's
 * schedule. Standing up a recurring export of company salary data is a write,
 * and the guard should say so.
 *
 * Reading the list stays on READ_REPORT: seeing which reports are scheduled is
 * the same kind of act as reading one.
 */
router.post("/", auth, requirePermission(PERMISSIONS.MANAGE_REPORT_SCHEDULE), createSchedule);
router.get("/", auth, requirePermission(PERMISSIONS.READ_REPORT), getSchedules);
router.delete("/:id", auth, requirePermission(PERMISSIONS.MANAGE_REPORT_SCHEDULE), deleteSchedule);

module.exports = router;
