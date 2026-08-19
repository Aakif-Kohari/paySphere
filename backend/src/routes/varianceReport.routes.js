'use strict';

const { Router } = require('express');

const auth = require('../middlewares/auth.middleware');
const { requireTenantScope } = require('../utils/tenantScope');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  monthlyVariance,
  annualForecast,
  setBudget,
  listBudgets,
} = require('../controllers/varianceReport.controller');

/**
 * Payroll variance, budgets and annual forecasting (#915).
 *
 * Every route on this router answered 403 to everybody, for two independent
 * reasons, and the feature has never worked (#1011). It was found by the
 * route-coverage test added alongside this change rather than by anyone using
 * it, which is its own sort of evidence.
 *
 * 1. There was no authentication on it at all.
 *
 *        const { verifyToken } = require('../middlewares/auth.middleware');
 *        router.use(verifyToken, requireTenantScope());
 *
 *    `auth.middleware` exports the middleware function itself — `module.exports
 *    = auth` — and has no `verifyToken` property, so that destructure produced
 *    `undefined`. Express 5 quietly drops a non-function passed to
 *    `router.use`, leaving `requireTenantScope()` as the only layer. Nothing
 *    ever set `req.tenantId`, so the guard refused every request.
 *
 *    That is the same missing export that took the workflow engine down at boot
 *    in #614. Here it failed silently instead, because `use` skipped it rather
 *    than throwing — arguably worse, since a boot failure gets noticed.
 *
 * 2. `authorize()` is not a permission check.
 *
 *        router.post('/budget', authorize('MANAGE_REPORTS'), setBudget);
 *
 *    `authorize(...allowedTypes)` compares against ACCOUNT_TYPE values —
 *    'ADMIN' and 'EMPLOYEE' — not against the RBAC permission vocabulary. It is
 *    the "who is this account" guard, not the "may they" one. `VIEW_REPORTS`
 *    and `MANAGE_REPORTS` are not account types and are not permissions either;
 *    neither name appears anywhere else in the codebase. So the comparison
 *    could never match:
 *
 *        authorize('MANAGE_REPORTS')({ accountType: 'ADMIN' }, res, next)
 *        // → 403 Access denied. Insufficient permissions.
 *
 * Both are fixed here, and the router now looks like every other one: `auth`,
 * then the tenant guard, then `requirePermission` with a name from
 * `config/permissions.js` that the new coverage test verifies exists.
 *
 * Reads use READ_REPORT, matching `reports.routes.js`. Writing a budget uses
 * WRITE_PAYROLL rather than a new permission: the budget is the payroll figure
 * that variance is measured against, and `forecast.routes.js` already gates
 * forecast generation the same way.
 */

const router = Router();

router.use(auth, requireTenantScope());

router.get(
  '/variance',
  requirePermission(PERMISSIONS.READ_REPORT),
  monthlyVariance,
);
router.get(
  '/forecast',
  requirePermission(PERMISSIONS.READ_REPORT),
  annualForecast,
);
router.get('/budget', requirePermission(PERMISSIONS.READ_REPORT), listBudgets);
router.post(
  '/budget',
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  setBudget,
);

module.exports = router;
