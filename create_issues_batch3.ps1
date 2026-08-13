$issues = @(
  @{
    title = "[FEATURE] Multi-Tenant Data Isolation with Tenant-Scoped Middleware and Schema-Level Enforcement"
    body  = @"
## Summary

PaySphere was designed as a multi-tenant SaaS payroll platform, but **every API endpoint currently operates without tenant isolation**. Any authenticated user can read and mutate records belonging to other companies by crafting a direct MongoDB ObjectId query. There is no tenant context propagated through the middleware stack, and no schema-level guard that prevents cross-tenant data leakage.

---

## Problem

1. **No tenant context in requests**: After JWT verification, `req.user` carries a `userId` but no `tenantId`. Controllers derive the scope from `createdBy: userId`, but that pattern breaks entirely for admins, portal users, and any future service-to-service call.
2. **Cross-tenant reads are trivially possible**: `GET /api/employees/:id` fetches by `_id` alone — any authenticated user who guesses or enumerates an ObjectId from another tenant receives that record with a 200.
3. **Cross-tenant writes**: `PUT /api/employees/:id` has the same flaw — a malicious user can overwrite another company's employee record.
4. **No schema enforcement**: Mongoose models have no built-in tenant guard. A query written without a `tenantId` filter silently returns all-tenant data.
5. **Missing `tenantId` on new models**: Models added after the initial scaffolding (e.g. `ExpenseClaim`, `Notification`, `AuditLog`) have no `tenantId` field at all.

---

## Proposed Solution

### 1. Tenant Middleware (`backend/src/middlewares/tenant.middleware.js`)
A new Express middleware, mounted immediately after `verifyToken`, that:
- Looks up the tenant associated with the authenticated user's account (`User.tenantId`).
- Stamps `req.tenantId` on the request object.
- Rejects with `403 Forbidden` if no tenant can be resolved.

### 2. Tenant-Scoped Query Helper (`backend/src/utils/tenantQuery.js`)
A utility function `scopeToTenant(query, req)` that merges `{ tenantId: req.tenantId }` into any Mongoose query object. Controllers use this instead of raw `{ createdBy: userId }`.

### 3. Mongoose Tenant Plugin (`backend/src/utils/tenantPlugin.js`)
A Mongoose schema plugin that:
- Automatically adds a required `tenantId` field to every schema it is applied to.
- Adds a `pre('save')` hook that asserts `tenantId` is set.
- Adds a `pre('find')` hook that injects `{ tenantId: this._conditions.tenantId }` as a safety net (belt-and-suspenders alongside the controller-level scope).

### 4. Tenant Guard Middleware (`backend/src/middlewares/tenantGuard.middleware.js`)
Applied to all routes that accept an `:id` param — verifies that the fetched document's `tenantId` matches `req.tenantId` before allowing the response through. Returns `403` if there is a mismatch, preventing IDOR attacks.

### 5. Schema Backfills
Apply `tenantPlugin` to: `Employee`, `Payroll`, `AuditLog`, `ExpenseClaim`, `Notification`, `SalaryStructure`, `Loan`, `Leave`.

### 6. Route Hardening
Replace all `createdBy: userId` patterns in employee, payroll, loan, and settlement controllers with `scopeToTenant(query, req)`.

---

## Files Affected

- `backend/src/middlewares/tenant.middleware.js` — **NEW**
- `backend/src/middlewares/tenantGuard.middleware.js` — **NEW**
- `backend/src/utils/tenantQuery.js` — **NEW**
- `backend/src/utils/tenantPlugin.js` — **NEW**
- `backend/src/models/employee.model.js` — MODIFY (apply plugin)
- `backend/src/models/payroll.model.js` — MODIFY (apply plugin)
- `backend/src/models/auditLog.model.js` — MODIFY (apply plugin)
- `backend/src/models/expenseClaim.model.js` — MODIFY (apply plugin)
- `backend/src/models/notification.model.js` — MODIFY (apply plugin)
- `backend/src/models/loan.model.js` — MODIFY (apply plugin)
- `backend/src/controllers/employee.controller.js` — MODIFY (use `scopeToTenant`)
- `backend/src/controllers/payroll.controller.js` — MODIFY (use `scopeToTenant`)
- `backend/src/controllers/loan.controller.js` — MODIFY (use `scopeToTenant`)
- `backend/src/app.js` — MODIFY (mount tenant middleware globally after auth)

---

## Acceptance Criteria

- [ ] `GET /api/employees/:id` with a valid token from Tenant A returns `403` when `:id` belongs to Tenant B.
- [ ] `POST /api/employees` automatically stamps `tenantId` on the created document without the controller explicitly setting it.
- [ ] A Mongoose query on `Employee` without a `tenantId` filter triggers a warning log (belt-and-suspenders hook).
- [ ] All existing controller tests pass with the new scoping applied.
- [ ] New employees created by Tenant A are never returned in `GET /api/employees` requests from Tenant B.
"@
  },
  @{
    title = "[FEATURE] OpenTelemetry Distributed Tracing & Structured Observability Pipeline"
    body  = @"
## Summary

PaySphere has no distributed tracing, no structured log correlation, and no performance profiling beyond `console.log` statements scattered across controllers. When a payroll run is slow or a webhook delivery fails, there is no way to trace the request lifecycle across the middleware stack, the database layer, the BullMQ worker, and the email service. This issue proposes implementing a production-grade **OpenTelemetry (OTel)** observability pipeline covering traces, metrics, and structured logs.

---

## Problem

1. **No request tracing**: A slow `POST /api/payroll/generate` produces no span data — there is no way to know whether the bottleneck is in the database query, the salary calculation, the PDF render, or the email send.
2. **Unstructured logs**: `logger.info('something happened')` with no request ID, span ID, or tenant context makes log aggregation useless at scale.
3. **No metrics**: There are no counters for payroll jobs processed per minute, no histograms for p95 DB query latency, and no error rate gauges.
4. **No correlation between BullMQ workers and HTTP requests**: The payroll worker logs have no link back to the originating HTTP request that enqueued the job.
5. **No alerting primitives**: Without metrics, it is impossible to configure alerts for SLO breaches (e.g. "payroll generation P99 > 30s").

---

## Proposed Solution

### 1. OTel SDK Bootstrap (`backend/src/telemetry/tracer.js`)
Initialize the `@opentelemetry/sdk-node` with:
- **OTLP HTTP exporter** pointing to `OTEL_EXPORTER_OTLP_ENDPOINT` (Jaeger / Tempo / Honeycomb).
- Auto-instrumentation for `express`, `mongoose`, `ioredis`, and `http`.
- Resource attributes: `service.name=paysphere-backend`, `service.version`, `deployment.environment`.

### 2. Request Correlation Middleware (`backend/src/middlewares/correlation.middleware.js`)
- Extracts or generates a `X-Request-ID` / `traceparent` header.
- Attaches `traceId`, `spanId`, and `requestId` to `req` and injects them into the Winston logger context via `logger.child({ traceId, requestId })`.
- Ensures every log line for a request carries the same trace ID.

### 3. Custom Span Helpers (`backend/src/telemetry/spans.js`)
Thin wrappers (`withSpan(name, fn)`, `recordError(span, err)`) used by controllers and services to create child spans around expensive operations (salary calculation, PDF render, external API calls).

### 4. Metrics Collector (`backend/src/telemetry/metrics.js`)
Using `@opentelemetry/api`:
- `payroll_jobs_total` — counter incremented on every BullMQ payroll job.
- `payroll_job_duration_seconds` — histogram of end-to-end job latency.
- `http_request_duration_seconds` — histogram of Express route latency (added in correlation middleware).
- `active_websocket_connections` — gauge from the Socket.IO server.

### 5. BullMQ Worker Trace Propagation (`backend/src/workers/payroll.worker.js`)
Inject the parent trace context into the BullMQ job data at enqueue time and extract it at process time so that worker spans are children of the originating HTTP span in the trace waterfall.

### 6. Health & Readiness Endpoints (`backend/src/routes/health.routes.js`)
- `GET /health/live` — Kubernetes liveness: returns `200` if the process is alive.
- `GET /health/ready` — Kubernetes readiness: checks MongoDB ping + Redis ping + returns `503` if either is degraded.
- `GET /health/metrics` — Prometheus scrape endpoint (via `prom-client`).

---

## Files Affected

- `backend/src/telemetry/tracer.js` — **NEW**
- `backend/src/telemetry/spans.js` — **NEW**
- `backend/src/telemetry/metrics.js` — **NEW**
- `backend/src/middlewares/correlation.middleware.js` — **NEW**
- `backend/src/routes/health.routes.js` — **NEW**
- `backend/src/controllers/health.controller.js` — **NEW**
- `backend/src/workers/payroll.worker.js` — MODIFY (trace propagation)
- `backend/src/index.js` — MODIFY (bootstrap tracer before app requires)
- `backend/src/app.js` — MODIFY (mount correlation and health routes)
- `backend/src/utils/logger.js` — MODIFY (inject trace context into log fields)
- `.env.example` — ADD `OTEL_EXPORTER_OTLP_ENDPOINT`

---

## Acceptance Criteria

- [ ] Every HTTP request has a unique `X-Request-ID` visible in the response headers and in every log line generated during that request.
- [ ] A Jaeger/Tempo-compatible trace is emitted for `POST /api/payroll/generate` showing child spans for DB queries and salary calculation.
- [ ] `GET /health/ready` returns `503` within 2 seconds when MongoDB is unreachable.
- [ ] `GET /health/metrics` returns Prometheus-formatted metrics including `payroll_jobs_total`.
- [ ] BullMQ worker spans appear as children of the originating HTTP span in the trace UI.
"@
  },
  @{
    title = "[FEATURE] Policy-Based Row-Level Security Engine for Dynamic Permission Scoping"
    body  = @"
## Summary

PaySphere's current RBAC system controls which **routes** a user can access (coarse-grained), but has no mechanism for **row-level security** — the ability to say "this manager can only read employees in Department A" or "this HR analyst can only view payroll records they personally created." Without row-level security, every authorized user sees every record in their tenant, regardless of their operational scope.

---

## Problem

1. **RBAC is route-level only**: `rbac.middleware.js` checks `permission` strings against a route, but once access is granted, the controller returns all documents without any further filtering based on the user's organizational scope.
2. **No department-level or team-level data scoping**: A departmental manager has no way to be restricted to seeing only their department's employees — they either have full read access or none.
3. **No policy engine**: There is no place to define data-scoping policies declaratively. Adding a new constraint requires modifying controller code directly, making the permission model rigid and hard to audit.
4. **Payroll access is all-or-nothing**: An HR analyst who should be able to view payroll records but not modify them currently needs full CRUD permission because view and write share the same policy.
5. **No field-level read policies**: Certain users (e.g. auditors) should see salary totals but not individual bank account numbers — there is no mechanism to express this today (the data masking middleware from #773 partially addresses this, but has no policy engine backing it).

---

## Proposed Solution

### 1. Policy Schema (`backend/src/models/policy.model.js`)
A MongoDB-backed policy definition:
```json
{
  "name": "department-manager-scope",
  "resource": "Employee",
  "action": "read",
  "conditions": {
    "field": "department",
    "op": "eq",
    "value": "{{user.department}}"
  },
  "effect": "allow",
  "roles": ["manager"]
}
```
Supports condition operators: `eq`, `in`, `startsWith`, `createdBy`.

### 2. Policy Engine Service (`backend/src/services/policy.service.js`)
- `PolicyService.buildQuery(resource, action, user)` — evaluates all applicable policies for the user's role and returns a Mongoose query filter that, when merged with the controller's base query, enforces the policy.
- `PolicyService.canAccessDocument(resource, action, user, document)` — post-fetch document-level check for single-record endpoints.
- Policies are cached in the in-process `CacheService` with a 60-second TTL to avoid repeated DB reads.

### 3. Row-Level Security Middleware (`backend/src/middlewares/rowLevelSecurity.middleware.js`)
A configurable middleware factory:
```js
rls('Employee', 'read')
```
Mounts between `verifyToken` and the controller. Calls `PolicyService.buildQuery` and attaches the result to `req.rlsFilter`. Controllers merge `req.rlsFilter` into their queries.

### 4. Policy Admin Controller & Routes
- `GET /api/policies` — list all policies (owner only).
- `POST /api/policies` — create a policy.
- `PUT /api/policies/:id` — update.
- `DELETE /api/policies/:id` — delete.

### 5. Built-In Seed Policies (`backend/src/seeds/policy.seed.js`)
Seed the following policies on first boot:
- `admin` → unrestricted access to all resources.
- `manager` → read-only access to employees in own department.
- `employee` → read-only access to own record only.

### 6. Frontend Policy Manager (`frontend/src/pages/PolicyManager.jsx`)
Admin UI for viewing, creating, and toggling policies with a JSON condition editor.

---

## Files Affected

- `backend/src/models/policy.model.js` — **NEW**
- `backend/src/services/policy.service.js` — **NEW**
- `backend/src/middlewares/rowLevelSecurity.middleware.js` — **NEW**
- `backend/src/controllers/policy.controller.js` — **NEW**
- `backend/src/routes/policy.routes.js` — **NEW**
- `backend/src/seeds/policy.seed.js` — **NEW**
- `backend/src/index.js` — MODIFY (run policy seed on boot)
- `backend/src/controllers/employee.controller.js` — MODIFY (merge `req.rlsFilter`)
- `backend/src/controllers/payroll.controller.js` — MODIFY (merge `req.rlsFilter`)
- `backend/src/app.js` — MODIFY (mount policy routes)
- `frontend/src/pages/PolicyManager.jsx` — **NEW**

---

## Acceptance Criteria

- [ ] A `manager`-role user with `department: "Engineering"` calling `GET /api/employees` receives only Engineering employees.
- [ ] A `manager`-role user calling `GET /api/employees/:id` for an employee outside their department receives `403`.
- [ ] An `admin`-role user is unaffected — sees all employees.
- [ ] Adding a new policy via `POST /api/policies` takes effect within 60 seconds without a server restart.
- [ ] The policy seed runs idempotently — running `startServer()` twice does not duplicate policies.
"@
  },
  @{
    title = "[FEATURE] Automated Payroll Variance Report with Budget Forecasting and Cost-Centre Drill-Down"
    body  = @"
## Summary

PaySphere generates monthly payslips but produces **no comparative analysis** between payroll runs. Finance teams have no way to understand why this month's total payroll is higher than last month's, which cost centre drove the increase, or how the year's projected spend compares to budget. This issue proposes a full **payroll variance and budget forecasting engine** with drill-down reporting.

---

## Problem

1. **No month-over-month variance**: There is no report that shows "total payroll increased by ₹2.4L vs last month — Engineering +₹1.8L, Sales -₹0.3L."
2. **No budget tracking**: There is no way to define a monthly or annual payroll budget per department and track actuals against it.
3. **No cost-centre breakdown**: Payroll records have no cost-centre dimension. All costs are summed at the company level, making departmental P&L reporting impossible.
4. **No forecasting**: There is no projection of full-year payroll cost based on current headcount, salary structures, and historical growth rates.
5. **Existing reports are static**: `GET /api/reports` returns flat employee or payroll data. There is no computed analytics layer — the frontend performs all aggregations, which breaks for large datasets and cannot be cached efficiently.

---

## Proposed Solution

### 1. Variance Report Service (`backend/src/services/varianceReport.service.js`)
Computes month-over-month and year-over-year comparisons using MongoDB aggregation pipelines:
- Group payroll records by `month`, `year`, `department`.
- Compute `delta` and `deltaPercent` for gross pay, net pay, headcount, average salary.
- Identify the top 5 employees with the largest salary change between periods.

### 2. Budget Model (`backend/src/models/budget.model.js`)
```js
{
  tenantId, department, year, month,
  budgetedGross: Number,  // planned spend
  actualGross: Number,    // populated after payroll run
  variance: Number,       // computed field
  variancePercent: Number
}
```

### 3. Budget Service (`backend/src/services/budget.service.js`)
- `setBudget(tenantId, department, year, month, amount)` — upserts a budget record.
- `computeActuals(tenantId, year, month)` — runs an aggregation pipeline to populate `actualGross` from `Payroll` records and compute `variance`.
- `forecastAnnual(tenantId, year)` — projects full-year spend using a weighted 3-month rolling average of actuals, then extrapolates for remaining months.

### 4. Cost-Centre Controller & Routes
- `GET /api/reports/variance?year=&month=&department=` — variance report.
- `GET /api/reports/budget?year=&department=` — budget vs actuals.
- `GET /api/reports/forecast?year=` — projected annual cost by department.
- `POST /api/reports/budget` — set or update a budget target.

### 5. Payroll Model Extension
Add `costCentre` (defaulting to `department`) and `varianceFlags` fields to the `Payroll` schema to mark anomalous salary changes inline.

### 6. Frontend Variance Dashboard (`frontend/src/pages/VarianceDashboard.jsx`)
- Recharts bar chart: current month vs previous month by department.
- Budget utilisation progress bars per department.
- Annual forecast line chart with confidence interval bands.
- Drill-down table: click a department bar → see individual employee-level changes.

---

## Files Affected

- `backend/src/services/varianceReport.service.js` — **NEW**
- `backend/src/services/budget.service.js` — **NEW**
- `backend/src/models/budget.model.js` — **NEW**
- `backend/src/controllers/varianceReport.controller.js` — **NEW**
- `backend/src/routes/varianceReport.routes.js` — **NEW**
- `backend/src/models/payroll.model.js` — MODIFY (add `costCentre`, `varianceFlags`)
- `backend/src/app.js` — MODIFY (mount variance report routes)
- `frontend/src/pages/VarianceDashboard.jsx` — **NEW**
- `frontend/src/components/reports/VarianceChart.jsx` — **NEW**
- `frontend/src/components/reports/BudgetGauge.jsx` — **NEW**
- `frontend/src/components/reports/ForecastChart.jsx` — **NEW**

---

## Acceptance Criteria

- [ ] `GET /api/reports/variance?year=2025&month=6` returns a JSON object with department-level `delta` and `deltaPercent` compared to May 2025.
- [ ] `GET /api/reports/forecast?year=2025` returns a 12-month projection array with `projected` and `actual` values per month.
- [ ] Setting a budget target via `POST /api/reports/budget` and then running payroll populates `actualGross` and `variance` automatically.
- [ ] The variance dashboard renders correctly for a tenant with 3+ months of payroll history.
- [ ] The `forecastAnnual` endpoint responds within 500ms for a dataset of 500 employees over 12 months (index-backed aggregation).
"@
  },
  @{
    title = "[FEATURE] Configurable Notification & Alert Delivery Engine (Email, In-App, Slack, SMS)"
    body  = @"
## Summary

PaySphere currently sends payslip emails via a single hardcoded email service (`email.service.js` using Nodemailer). There is no general-purpose notification infrastructure — no way for admins to configure which events trigger notifications, via which channels, or to which recipients. When a payroll run completes, a salary changes, or an expense claim is approved, the system has no delivery mechanism beyond the payslip email. This issue proposes a **multi-channel, event-driven notification engine** with a pluggable delivery provider architecture.

---

## Problem

1. **Only payslip email is sent**: No notification is dispatched when a new employee is added, a salary is revised, a loan EMI is deducted, an expense claim changes status, or an approval workflow advances.
2. **Email is hardcoded to Nodemailer**: Switching to SendGrid, AWS SES, or Resend requires modifying `email.service.js` directly. There is no provider abstraction.
3. **No Slack integration**: Payroll approvals have no Slack notification path — managers must log into the app to see pending approvals.
4. **No SMS delivery**: High-priority events (e.g. payroll completion, large salary changes) have no SMS channel.
5. **No notification preferences**: Users cannot control which events they receive, via which channel, or at what frequency. All-or-nothing.
6. **In-app notifications are disconnected**: The `Notification` model exists and the notification controller was scaffolded, but no part of the system actually creates `Notification` documents — the in-app notification centre is always empty.

---

## Proposed Solution

### 1. Notification Provider Interface (`backend/src/notifications/base.provider.js`)
Abstract base class with one method: `send({ to, subject, body, metadata })`. All channel providers implement this.

### 2. Channel Providers
- `backend/src/notifications/email.provider.js` — wraps the existing `email.service.js`.
- `backend/src/notifications/slack.provider.js` — uses Slack Incoming Webhooks API.
- `backend/src/notifications/inApp.provider.js` — creates a `Notification` document and emits a Socket.IO event to the user's session.
- `backend/src/notifications/sms.provider.js` — stub for Twilio/AWS SNS (provider-agnostic interface).

### 3. Notification Registry (`backend/src/notifications/registry.js`)
Maps channel names (`'email'`, `'slack'`, `'in_app'`, `'sms'`) to provider instances. Providers are lazily initialised based on environment variables.

### 4. Notification Event Schema (`backend/src/models/notificationEvent.model.js`)
Defines named event types (`PAYROLL_COMPLETED`, `SALARY_CHANGED`, `EXPENSE_APPROVED`, `LOAN_DEDUCTED`, etc.) and their default channel mappings and template slugs.

### 5. Notification Preference Model (`backend/src/models/notificationPreference.model.js`)
Per-user channel preferences: `{ userId, eventType, channels: ['email', 'in_app'], enabled: true }`.

### 6. Notification Dispatcher Service (`backend/src/services/notificationDispatcher.service.js`)
The central orchestrator:
- `dispatch(eventType, payload, userId)` — looks up the user's preferences, renders the template for each enabled channel, and calls the appropriate provider.
- Uses BullMQ to deliver notifications asynchronously — notifications never block the request path.
- Implements per-user per-event-type deduplication with a 5-minute window (prevents notification storms).

### 7. Notification Worker (`backend/src/workers/notification.worker.js`)
BullMQ worker that consumes the `notification-delivery` queue and calls `registry.get(channel).send(...)`.

### 8. Integration Points
Wire `notificationDispatcher.dispatch` calls into:
- `payroll.controller.js` — `PAYROLL_COMPLETED` after successful run.
- `employee.controller.js` — `EMPLOYEE_ONBOARDED` on creation.
- `loan.controller.js` — `LOAN_DEDUCTED` when EMI is recovered.
- `expense.controller.js` — `EXPENSE_APPROVED` / `EXPENSE_REJECTED`.

### 9. Notification Preferences UI (`frontend/src/pages/NotificationPreferences.jsx`)
Settings page where users toggle event types and delivery channels, with a "Send test notification" button per channel.

---

## Files Affected

- `backend/src/notifications/base.provider.js` — **NEW**
- `backend/src/notifications/email.provider.js` — **NEW**
- `backend/src/notifications/slack.provider.js` — **NEW**
- `backend/src/notifications/inApp.provider.js` — **NEW**
- `backend/src/notifications/sms.provider.js` — **NEW**
- `backend/src/notifications/registry.js` — **NEW**
- `backend/src/models/notificationEvent.model.js` — **NEW**
- `backend/src/models/notificationPreference.model.js` — **NEW**
- `backend/src/services/notificationDispatcher.service.js` — **NEW**
- `backend/src/workers/notification.worker.js` — **NEW**
- `backend/src/controllers/notificationPreference.controller.js` — **NEW**
- `backend/src/routes/notificationPreference.routes.js` — **NEW**
- `backend/src/controllers/payroll.controller.js` — MODIFY (dispatch `PAYROLL_COMPLETED`)
- `backend/src/controllers/employee.controller.js` — MODIFY (dispatch `EMPLOYEE_ONBOARDED`)
- `backend/src/index.js` — MODIFY (start notification worker)
- `frontend/src/pages/NotificationPreferences.jsx` — **NEW**

---

## Acceptance Criteria

- [ ] Running a payroll creates a `PAYROLL_COMPLETED` `Notification` document for all users with `in_app` enabled for that event.
- [ ] A user with `slack` enabled for `SALARY_CHANGED` receives a Slack message when their salary is updated.
- [ ] Disabling all channels for an event type in preferences silences that event completely.
- [ ] The notification worker processes deliveries without blocking the HTTP response — `POST /api/payroll/generate` returns before the email is sent.
- [ ] A provider failure (e.g. Slack webhook 500) does not crash the worker — error is logged, the job retries via BullMQ's retry policy.
- [ ] Adding a new notification channel requires only creating a new provider file and registering it — no controller changes.
"@
  }
)

foreach ($issue in $issues) {
  $bodyFile = [System.IO.Path]::GetTempFileName()
  $issue.body | Out-File -FilePath $bodyFile -Encoding utf8
  gh issue create --title $issue.title --body-file $bodyFile --label "enhancement,ECSoC26"
  Remove-Item $bodyFile
  Start-Sleep -Seconds 2
}
