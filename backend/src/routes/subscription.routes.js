/**
 * Subscription Routes - Issue #1113
 *
 * Tenant endpoints (authenticated):
 *   GET  /api/tenant/subscription          — current plan, usage, features
 *   POST /api/tenant/subscription/upgrade   — upgrade to a higher plan
 *   POST /api/tenant/subscription/cancel    — cancel or downgrade
 *   GET  /api/tenant/subscription/usage     — detailed usage info
 *
 * Admin endpoints (owner only):
 *   GET  /api/admin/subscriptions           — list all subscriptions
 *   GET  /api/admin/subscriptions/stats     — aggregate metrics
 *
 * Mounted in app.js:
 *   app.use('/api/tenant', subscriptionTenantRoutes)
 *   app.use('/api/admin',  subscriptionAdminRoutes)
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  getSubscription,
  upgradeSubscription,
  cancelSubscription,
  getUsageInfo,
  getAdminSubscriptions,
  getSubscriptionStats,
} = require('../controllers/subscription.controller');

// ---------------------------------------------------------------------------
// Tenant routes — scoped to the caller's tenant via auth middleware
// ---------------------------------------------------------------------------

const tenantRouter = Router();

/**
 * GET /subscription
 *
 * Returns the tenant's current plan, feature list, limits, and live usage
 * counters. Auto-creates a basic trial subscription on first access.
 */
tenantRouter.get('/subscription', auth, getSubscription);

/**
 * POST /subscription/upgrade
 *
 * Upgrade the tenant's plan. Currently a stub that activates immediately;
 * in production this would create a Stripe Checkout session.
 *
 * Body: { planSlug: 'pro' | 'enterprise' }
 * Rate-limited to prevent abuse.
 */
tenantRouter.post(
  '/subscription/upgrade',
  auth,
  writeRateLimiter,
  upgradeSubscription,
);

/**
 * POST /subscription/cancel
 *
 * Cancel or downgrade the tenant's subscription.
 * Cancellation preserves read access; downgrade reverts to basic.
 *
 * Body: { downgrade?: boolean }
 * Rate-limited to prevent accidental bulk operations.
 */
tenantRouter.post(
  '/subscription/cancel',
  auth,
  writeRateLimiter,
  cancelSubscription,
);

/**
 * GET /subscription/usage
 *
 * Detailed usage information: current counters, per-metric limit checks,
 * and usage history.
 */
tenantRouter.get('/subscription/usage', auth, getUsageInfo);

// ---------------------------------------------------------------------------
// Admin routes — require owner/admin role
// ---------------------------------------------------------------------------

const adminRouter = Router();

/**
 * Middleware to enforce owner/admin access for subscription admin endpoints.
 *
 * In a full RBAC setup this would be:
 *   requirePermission(PERMISSIONS.MANAGE_SUBSCRIPTION)
 *
 * For now, we check that the authenticated user has an 'owner' or 'admin'
 * account type, which is resolved by auth.middleware.js via resolveAccountType.
 */
function requireOwnerOrAdmin(req, res, next) {
  const accountType = req.user?.accountType || req.user?.role;
  const allowed = ['owner', 'admin', 'superadmin', 'super_admin'];

  if (!accountType || !allowed.includes(accountType)) {
    return res.status(403).json({
      message: 'This action requires owner or admin privileges.',
    });
  }

  next();
}

/**
 * GET /subscriptions
 *
 * Paginated list of all tenant subscriptions with plan details and usage.
 * Supports filtering by status and plan slug.
 *
 * Query params:
 *   status — filter by subscription status (trialing|active|past_due|cancelled)
 *   plan   — filter by plan slug (basic|pro|enterprise)
 *   page   — page number (default 1)
 *   limit  — items per page (default 50, max 200)
 */
adminRouter.get(
  '/subscriptions',
  auth,
  requireOwnerOrAdmin,
  getAdminSubscriptions,
);

/**
 * GET /subscriptions/stats
 *
 * Aggregate subscription metrics: breakdown by plan, by status,
 * total active tenants, and Monthly Recurring Revenue.
 */
adminRouter.get(
  '/subscriptions/stats',
  auth,
  requireOwnerOrAdmin,
  getSubscriptionStats,
);

module.exports = { tenantRouter, adminRouter };
