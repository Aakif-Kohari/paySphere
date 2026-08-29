## Summary

PaySphere is a multi-tenant SaaS product but has no concept of subscription plans or feature gating. Every tenant gets every feature regardless of what they pay for. There is no admin console for plan management, no runtime feature-flag evaluation, and no metered usage tracking to support usage-based billing. Adding a paid tier requires code changes rather than a data change.

## Problem Statement

1. **No plan model**: 	enant.model.js has no plan or eatures field. All routes are open to all tenants. Introducing a "Basic / Pro / Enterprise" tier today would require adding if (tenant.plan === 'pro') guards scattered throughout every controller — the wrong abstraction.
2. **No feature-flag evaluation**: There is no central authority deciding whether 	enant X can call POST /api/reports/variance. The check needs to happen at the middleware layer, not inside each controller.
3. **No metered usage**: Usage-based billing (per-payslip, per-employee, per-API-call) has no counter infrastructure. Without counters there is no basis for overage alerts or invoice line items.
4. **No tenant self-serve portal**: Tenants cannot view their plan, see usage, or initiate an upgrade without contacting support.
5. **No kill-switch**: When a tenant's payment lapses, there is no mechanism to restrict access to write operations while preserving read access so they can export their data.

## Proposed Implementation

### Backend

- **plan.model.js** (new): Defines plan tiers — { name, slug, features: [string], limits: { employeeCount, apiCallsPerMonth, reportSchedules }, monthlyPrice }.
- **	enantSubscription.model.js** (new): Per-tenant subscription document — { tenantId, planSlug, status: active|past_due|cancelled|trialing, currentPeriodEnd, usage: { employees, apiCalls, reportSchedules }, overageAlertSentAt }.
- **eatureFlag.middleware.js** (new): equireFeature(featureSlug) factory — resolves 	enantSubscription from cache (60s TTL via cache.service.js), checks plan.features.includes(featureSlug). Returns 402 { message: "This feature requires a Pro plan or above.", upgradeUrl } on failure. Logs access attempts for telemetry.
- **usageCounter.service.js** (new):
  - increment(tenantId, metric, delta) — Redis HINCRBY on a daily bucket key usage:{tenantId}:{YYYY-MM}:{metric}.
  - getMonthlyUsage(tenantId) — aggregates all daily keys for the month.
  - checkLimit(tenantId, metric) — compares against plan.limits; returns { allowed, current, limit, overage }.
  - BullMQ daily job usageRollup.job.js — persists Redis counters to 	enantSubscription.usage for billing and resets daily keys.
- **subscription.controller.js** (new): GET /api/tenant/subscription (current plan + usage), POST /api/tenant/subscription/upgrade (stub — creates a Stripe checkout session or marks intent), GET /api/admin/subscriptions (admin overview).

### Frontend

- **SubscriptionPortal.jsx** (new): Current plan card, usage gauges (employees used vs limit, API calls, scheduled reports), upgrade CTA.
- **PlanComparison.jsx** (new): Feature matrix table — rows are features, columns are plans, tick/cross cells.
- **FeatureGate.jsx** (new): React component wrapper — <FeatureGate feature="VARIANCE_REPORT"><Reports /></FeatureGate>. Renders a "Upgrade to Pro" banner if the feature is not included in the tenant's plan.

## Files Affected

- ackend/src/models/plan.model.js — new
- ackend/src/models/tenantSubscription.model.js — new
- ackend/src/middlewares/featureFlag.middleware.js — new
- ackend/src/services/usageCounter.service.js — new
- ackend/src/jobs/usageRollup.job.js — new
- ackend/src/controllers/subscription.controller.js — new
- ackend/src/routes/subscription.routes.js — new
- ackend/src/seeds/plan.seed.js — new (Basic, Pro, Enterprise defaults)
- ackend/src/app.js — mount routes
- rontend/src/pages/Settings.jsx — add Subscription tab
- rontend/src/components/SubscriptionPortal.jsx — new
- rontend/src/components/PlanComparison.jsx — new
- rontend/src/components/FeatureGate.jsx — new

## Acceptance Criteria

- [ ] equireFeature('VARIANCE_REPORT') on a Basic-plan tenant returns 402 with upgradeUrl.
- [ ] equireFeature('VARIANCE_REPORT') on a Pro-plan tenant proceeds to the controller.
- [ ] Feature flag resolution is cached for 60 seconds per tenant; a plan downgrade takes effect within 60 seconds.
- [ ] usageCounter.increment survives a Redis restart — the daily rollup job has already persisted the previous day's data.
- [ ] GET /api/tenant/subscription returns { plan, usage: { employees: { current, limit }, apiCalls: { current, limit } } }.
- [ ] The FeatureGate component renders the upgrade banner server-driven (feature list comes from /api/tenant/subscription), not hardcoded in the frontend bundle.
