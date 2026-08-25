/**
 * HRMS integration routes (#954).
 *
 * There was no router for `src/integrations/` at all, which is why nothing had
 * ever built an adapter: `registry.getAdapter()` was reachable from no request.
 *
 * Every route takes `MANAGE_INTEGRATIONS`, including the reads. Connecting an
 * HRMS points an external system at the whole employee directory and lets it
 * write into it, and even a masked config tells the reader which provider a
 * company uses and when it last ran. That is the authority `MANAGE_WEBHOOKS`
 * describes — deliberately kept with the owner in #474 — rather than the
 * day-to-day `WRITE_EMPLOYEE`.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { integrationSecurity } = require('../middlewares/integrationSecurity');
const { PERMISSIONS } = require('../config/permissions');
const {
  listProviders,
  listIntegrations,
  upsertIntegration,
  triggerSync,
  deleteIntegration,
} = require('../controllers/integration.controller');

const router = express.Router();

// Declared before `/:provider` so the literal segment is matched as a literal,
// following the ordering convention the other routers use.
router.get(
  '/providers',
  auth,
  requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS),
  listProviders,
);

router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS),
  listIntegrations,
);

router.put(
  '/:provider',
  auth,
  requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS),
  writeRateLimiter,
  upsertIntegration,
);

// Rate limited like a write, because it is one: a sync creates and updates
// employee records, and it also spends the tenant's quota at the provider.
router.post(
  '/:provider/sync',
  auth,
  requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS),
  writeRateLimiter,
  triggerSync,
);

router.post(
  '/:provider/sync-receiver',
  integrationSecurity,
  triggerSync,
);

router.get(
  '/:provider/mapping',
  auth,
  requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS),
  require('../controllers/integration.controller').getFieldMapping
);

router.put(
  '/:provider/mapping',
  auth,
  requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS),
  writeRateLimiter,
  require('../controllers/integration.controller').saveFieldMapping
);

router.delete(
  '/:provider',
  auth,
  requirePermission(PERMISSIONS.MANAGE_INTEGRATIONS),
  writeRateLimiter,
  deleteIntegration,
);

module.exports = router;
