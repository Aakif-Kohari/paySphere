const express = require("express");
const {
  createWebhook,
  getWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  regenerateWebhookSecret,
  getWebhookDeliveries,
  retryWebhookDelivery,
} = require("../controllers/webhook.controller");
const auth = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { writeRateLimiter } = require("../middlewares/rateLimiter.middleware");
const { PERMISSIONS } = require("../config/permissions");

const router = express.Router();

/**
 * Every route is gated on MANAGE_WEBHOOKS (#474).
 *
 * A webhook endpoint is a standing instruction to POST company payroll and
 * employee data to an external URL, signed with a secret. Reading the list is
 * security-relevant the same way the writes are, so — unlike the report
 * schedules — even the GETs stay on the dedicated permission rather than the
 * broader read permissions.
 */

router.get("/", auth, requirePermission(PERMISSIONS.MANAGE_WEBHOOKS), getWebhooks);

// Declared before `/:id` so the literal suffixes are not captured as an id.
router.get(
  "/:id/deliveries",
  auth,
  requirePermission(PERMISSIONS.MANAGE_WEBHOOKS),
  getWebhookDeliveries,
);

router.get("/:id", auth, requirePermission(PERMISSIONS.MANAGE_WEBHOOKS), getWebhook);

router.post(
  "/",
  auth,
  requirePermission(PERMISSIONS.MANAGE_WEBHOOKS),
  writeRateLimiter,
  createWebhook,
);

router.post(
  "/:id/regenerate-secret",
  auth,
  requirePermission(PERMISSIONS.MANAGE_WEBHOOKS),
  writeRateLimiter,
  regenerateWebhookSecret,
);

router.patch(
  "/:id",
  auth,
  requirePermission(PERMISSIONS.MANAGE_WEBHOOKS),
  writeRateLimiter,
  updateWebhook,
);

router.post(
  "/:id/test",
  auth,
  requirePermission(PERMISSIONS.MANAGE_WEBHOOKS),
  writeRateLimiter,
  require("../controllers/webhook.controller").testWebhook
);

router.post(
  "/deliveries/:id/retry",
  auth,
  requirePermission(PERMISSIONS.MANAGE_WEBHOOKS),
  writeRateLimiter,
  retryWebhookDelivery,
);

router.delete(
  "/:id",
  auth,
  requirePermission(PERMISSIONS.MANAGE_WEBHOOKS),
  writeRateLimiter,
  deleteWebhook,
);

module.exports = router;
