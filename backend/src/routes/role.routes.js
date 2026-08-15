const express = require("express");
const {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} = require("../controllers/role.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { writeRateLimiter } = require("../middlewares/rateLimiter.middleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

/**
 * Custom role management (#475).
 *
 * Every route is gated on MANAGE_ROLES. Roles decide what every account in the
 * workspace may do, so reading the catalog is security-relevant the same way
 * the writes are — the list names every capability in the company and who may
 * hold it — so even the GET stays on the dedicated permission.
 */

router.get(
  "/",
  auth,
  getRoles,
);

router.post(
  "/",
  auth,
  requirePermission(PERMISSIONS.MANAGE_ROLES),
  writeRateLimiter,
  createRole,
);

router.patch(
  "/:id",
  auth,
  requirePermission(PERMISSIONS.MANAGE_ROLES),
  writeRateLimiter,
  updateRole,
);

router.delete(
  "/:id",
  auth,
  requirePermission(PERMISSIONS.MANAGE_ROLES),
  writeRateLimiter,
  deleteRole,
);

module.exports = router;
