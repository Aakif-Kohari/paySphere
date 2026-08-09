$issues = @(
  @{
    title = "[FEATURE] Full-Text Search Engine Integration with Elasticsearch for Employees, Payroll & Audit Logs"
    body  = @"
## Summary

PaySphere currently has no search capability beyond basic Mongoose `\$regex` queries, which do not scale — they cannot index across multiple collections, do not support fuzzy matching, and degrade dramatically on large datasets. This issue proposes a deep integration of **Elasticsearch** (or OpenSearch) as the primary search layer for all high-volume data: Employees, Payroll records, and Audit Logs.

---

## Problem

- HR admins searching for an employee by partial name, employee ID, or email perform a `\$regex` scan on a full MongoDB collection with no indexes. This causes a full collection scan on every request.
- Cross-collection searches (e.g. "show all payroll runs AND audit events for John Doe") are entirely impossible without multiple sequential round-trips.
- Audit Logs for compliance searches (e.g. "all actions between Jan–Mar 2025 by user X") have no full-text support.
- The existing `GET /api/employees?search=` endpoint directly injects unsanitized regex strings into Mongoose queries, introducing a potential ReDoS vulnerability.

---

## Proposed Solution

1. **Elasticsearch Sync Service** (`backend/src/services/elasticsearch.service.js`): A dedicated service that wraps the `@elastic/elasticsearch` client and exposes indexing and search APIs.
2. **Index Definitions**: Create explicit index mappings for three ES indices: `paySphere-employees`, `paySphere-payroll`, `paySphere-audit-logs`.
3. **Mongoose Change Stream Listeners**: Attach `post('save')` and `post('remove')` Mongoose hooks on `Employee`, `Payroll`, and `AuditLog` models to sync documents into Elasticsearch in real-time.
4. **Search Controller** (`backend/src/controllers/search.controller.js`): A new REST controller with `GET /api/search?q=&index=employees|payroll|audit-logs` that executes the Elasticsearch query and returns ranked results.
5. **Search Route** (`backend/src/routes/search.routes.js`): Mount the new search controller.
6. **Frontend Global Search Bar** (`frontend/src/components/GlobalSearch.jsx`): A command-palette-style search bar that calls the backend search API and renders categorized results.
7. **Docker Compose Update** (`docker-compose.yml`): Add an Elasticsearch node to the development stack.

---

## Files Affected

- `backend/src/services/elasticsearch.service.js` — NEW
- `backend/src/controllers/search.controller.js` — NEW
- `backend/src/routes/search.routes.js` — NEW
- `backend/src/models/employee.model.js` — ADD Mongoose post-hooks
- `backend/src/models/payroll.model.js` — ADD Mongoose post-hooks
- `backend/src/listeners/audit.listener.js` — ADD ES sync on audit creation
- `backend/src/app.js` — Mount search routes
- `frontend/src/components/GlobalSearch.jsx` — NEW
- `frontend/src/components/Sidebar.jsx` — ADD search bar trigger
- `docker-compose.yml` — ADD Elasticsearch service node

---

## Acceptance Criteria

- [ ] Searching `GET /api/search?q=john&index=employees` returns ranked results using Elasticsearch BM25 scoring.
- [ ] Creating a new employee automatically syncs the document into the `paySphere-employees` index within 1 second.
- [ ] Cross-collection results are returned in a single request without sequential MongoDB queries.
- [ ] The old `\$regex` search in `employee.controller.js` is replaced by the ES query layer.
- [ ] Invalid regex characters in search inputs no longer cause a 500 error.
"@
  },
  @{
    title = "[FEATURE] Distributed Cron Job Scheduler with Database Locking to Prevent Duplicate Payroll Runs"
    body  = @"
## Summary

PaySphere uses a basic `node-cron` scheduler inside `backend/src/index.js` to fire monthly payroll jobs. This approach has a critical architectural flaw: if the application is ever scaled to multiple instances (horizontal scaling, Kubernetes pods, PM2 cluster mode), **every instance fires the same cron simultaneously**, which causes duplicate payroll runs, double salary disbursements, and data corruption.

---

## Problem

- `node-cron` runs inside the Node.js process with no coordination across instances.
- No distributed lock prevents two API server pods from both triggering `generatePayroll` at the same scheduled time.
- The `CronLock` model already exists in the codebase (`backend/src/models/cronlock.model.js`) but is never used by any service, making it dead code.
- Payroll workers (`backend/src/workers/payroll.worker.js`) have no idempotency guard — re-running a job on the same `month/year` will insert duplicate payroll records.

---

## Proposed Solution

1. **Distributed Lock Service** (`backend/src/services/cronLock.service.js`): Implement a Mongoose-backed distributed mutex using the existing `CronLock` model and MongoDB's atomic `findOneAndUpdate` with `upsert: true` and a TTL-based lease (e.g. 5-minute lock expiry).
2. **Idempotency Guard in Payroll Worker**: Before processing, the worker checks whether a `PayrollRun` document already exists for the given `tenantId + month + year` combination. If it does, the job exits gracefully.
3. **Queue Service Refactor** (`backend/src/jobs/queue.service.js`): Wrap the cron trigger inside the `acquireLock / releaseLock` lifecycle of the `CronLockService`.
4. **Cron Job Configuration via DB** (`backend/src/models/cronConfig.model.js`): NEW model to allow super-admins to configure cron schedules (e.g. "Run on 28th of every month") per tenant through the UI without redeployment.
5. **Admin Cron UI** (`frontend/src/pages/CronScheduler.jsx`): A new admin page displaying scheduled jobs, their last-run status, lock holder, and manual trigger capability.

---

## Files Affected

- `backend/src/services/cronLock.service.js` — NEW
- `backend/src/models/cronConfig.model.js` — NEW
- `backend/src/jobs/queue.service.js` — MODIFY (integrate lock service)
- `backend/src/workers/payroll.worker.js` — MODIFY (add idempotency guard)
- `backend/src/models/cronlock.model.js` — ACTIVATE (wire to lock service)
- `backend/src/index.js` — MODIFY (remove bare cron, use queue service)
- `frontend/src/pages/CronScheduler.jsx` — NEW
- `frontend/src/services/api.js` — ADD cron management API calls

---

## Acceptance Criteria

- [ ] Running two server instances simultaneously only triggers payroll processing once per scheduled period.
- [ ] A lock that is never released (dead process) expires after the TTL, allowing the next instance to pick it up.
- [ ] Re-running the payroll job for an already-processed `month/year` is a no-op and logs a warning.
- [ ] Super-admin can change the cron schedule through the UI without requiring a server restart.
"@
  },
  @{
    title = "[FEATURE] End-to-End Encryption (E2EE) for Sensitive Employee PII at Rest"
    body  = @"
## Summary

PaySphere stores highly sensitive Personally Identifiable Information (PII) — bank account numbers, PAN/National ID, base salary — in plaintext inside MongoDB. This violates GDPR Article 25, SOC 2 Type II controls, and common payroll data handling standards. This issue proposes implementing **application-layer field-level encryption (FLE)** for all sensitive fields before they are persisted to MongoDB.

---

## Problem

- Fields like `bankAccount`, `panNumber`, `monthlySalary`, and `taxId` are stored in plaintext in the `Employee` and `SalaryStructure` collections.
- A single MongoDB credential leak or a misconfigured Atlas IP allowlist exposes every employee's financial data.
- There is no data masking when the API returns employee records — raw bank account numbers are sent over the wire to any authenticated user.
- No field-level access control prevents a read-only manager from seeing full salary breakdowns.

---

## Proposed Solution

1. **Encryption Service** (`backend/src/services/encryption.service.js`): A wrapper around Node's `crypto` module implementing AES-256-GCM symmetric encryption/decryption. The encryption key is loaded from an environment variable and never hardcoded.
2. **Mongoose Encryption Plugin** (`backend/src/utils/encryptPlugin.js`): A reusable Mongoose plugin that can be applied to any schema to automatically encrypt specified fields on `save` and decrypt them on `find`. Fields are encrypted before hitting the database adapter.
3. **Schema Updates**: Apply the encryption plugin to sensitive fields in `employee.model.js` (`bankAccount`, `panNumber`) and `salaryStructure.model.js` (`monthlySalary`, `components`).
4. **Data Masking Middleware** (`backend/src/middlewares/dataMask.middleware.js`): Response interceptor that replaces sensitive field values with masked representations (e.g. `****6789`) based on the requesting user's RBAC role before sending the API response.
5. **Key Rotation Utility** (`backend/src/utils/keyRotation.js`): A one-off migration script that re-encrypts all existing records with a new key — critical for periodic key rotation compliance.
6. **Frontend PII Masking** (`frontend/src/utils/piiMask.js`): Utility that masks values in the React UI layer for non-admin roles.

---

## Files Affected

- `backend/src/services/encryption.service.js` — NEW
- `backend/src/utils/encryptPlugin.js` — NEW
- `backend/src/utils/keyRotation.js` — NEW (migration script)
- `backend/src/middlewares/dataMask.middleware.js` — NEW
- `backend/src/models/employee.model.js` — MODIFY (apply encrypt plugin)
- `backend/src/models/salaryStructure.model.js` — MODIFY (apply encrypt plugin)
- `backend/src/controllers/employee.controller.js` — MODIFY (apply mask middleware)
- `frontend/src/utils/piiMask.js` — NEW
- `.env.example` — ADD `ENCRYPTION_KEY` variable

---

## Acceptance Criteria

- [ ] `bankAccount` and `panNumber` values stored in MongoDB are AES-256-GCM ciphertext, not plaintext.
- [ ] Decryption is transparent — `GET /api/employees/:id` returns plaintext for authorized users without manual decryption in the controller.
- [ ] A manager-role user sees `****6789` for bank account numbers instead of the full value.
- [ ] The key rotation script re-encrypts all records and validates them without data loss.
- [ ] No encryption key is present anywhere in source code or git history.
"@
  },
  @{
    title = "[FEATURE] Plugin Architecture for Third-Party HRMS Integrations (BambooHR, Workday, ADP)"
    body  = @"
## Summary

PaySphere is an isolated payroll system with no mechanism to sync employee data from enterprise HRMS platforms. Companies using **BambooHR**, **Workday**, or **ADP** must manually recreate every employee — names, departments, job titles, employment dates — inside PaySphere, leading to constant data drift, duplicate effort, and sync errors. This issue proposes a **plugin-based integration architecture** that allows PaySphere to pull from and push to external HRMS platforms in a standardized, extensible way.

---

## Problem

- No integration layer exists between PaySphere and upstream HR systems.
- Employee data is entered manually, creating mismatches whenever HR updates a job title or department in BambooHR.
- There is no event-driven sync — a terminated employee in Workday remains active in PaySphere until manually offboarded.
- Future integrations (ADP, SAP, Rippling) would require building new one-off code inside controllers, making the codebase unmaintainable.

---

## Proposed Solution

1. **Integration Plugin Interface** (`backend/src/integrations/base.integration.js`): Define an abstract base class (`BaseIntegration`) that all HRMS adapters must implement: `fetchEmployees()`, `pushPayslip()`, `onEmployeeTerminated()`.
2. **BambooHR Adapter** (`backend/src/integrations/bamboohr.integration.js`): Concrete implementation using BambooHR's REST API v1 to pull active employees and map them to PaySphere's `Employee` schema.
3. **Workday Adapter** (`backend/src/integrations/workday.integration.js`): Concrete implementation using Workday's RAAS (Report-as-a-Service) endpoints.
4. **Integration Registry** (`backend/src/integrations/registry.js`): A singleton that loads configured adapters at startup based on tenant-level environment settings.
5. **Sync Job** (`backend/src/jobs/hrmsSync.job.js`): A scheduled job (daily cron) that calls `registry.getAdapter(tenantId).fetchEmployees()` and upserts the results into the `Employee` collection.
6. **Integration Config Model** (`backend/src/models/integrationConfig.model.js`): Mongoose schema storing per-tenant API keys, sync schedules, and field mapping overrides (encrypted using the `EncryptionService`).
7. **Integrations Admin UI** (`frontend/src/pages/Integrations.jsx`): A new settings page where admins can connect external HRMS platforms, configure field mappings, and view sync history logs.

---

## Files Affected

- `backend/src/integrations/base.integration.js` — NEW
- `backend/src/integrations/bamboohr.integration.js` — NEW
- `backend/src/integrations/workday.integration.js` — NEW
- `backend/src/integrations/registry.js` — NEW
- `backend/src/jobs/hrmsSync.job.js` — NEW
- `backend/src/models/integrationConfig.model.js` — NEW
- `backend/src/controllers/integration.controller.js` — NEW
- `backend/src/routes/integration.routes.js` — NEW
- `frontend/src/pages/Integrations.jsx` — NEW
- `frontend/src/services/api.js` — ADD integration API calls

---

## Acceptance Criteria

- [ ] Connecting a BambooHR account syncs all active employees into PaySphere without duplicates.
- [ ] A terminated employee in BambooHR is automatically soft-deleted in PaySphere on the next sync.
- [ ] Adding a new adapter (e.g. ADP) only requires creating a new file implementing `BaseIntegration` — no changes to controllers.
- [ ] API credentials for integrations are encrypted at rest using `EncryptionService`.
- [ ] Admins can view the last sync time, records synced, and any errors from the Integrations UI.
"@
  },
  @{
    title = "[FEATURE] Real-Time Payroll Audit Log Streaming Dashboard with WebSocket & Anomaly Alerts"
    body  = @"
## Summary

PaySphere currently writes audit log entries to MongoDB but surfaces them only through a paginated, polling-based table in the UI. Compliance officers and finance teams working on live payroll runs have no real-time visibility into what mutations are happening as they happen. This issue proposes a **live audit log streaming dashboard** powered by WebSocket subscriptions, with an inline rule-based alert system that flags suspicious mutations in real time.

---

## Problem

- The `GET /api/audit-logs` endpoint is polled manually — there is no push mechanism for real-time updates.
- Finance officers approving a large payroll run cannot see concurrent modifications from other admins.
- There is no alerting system for high-risk audit events (e.g. "salary changed by more than 30% within the same payroll period", "user performed 50+ mutations in 5 minutes").
- The existing `audit.listener.js` emits local Node.js events that are consumed by nothing in production.
- The existing `payroll.socket.js` manages a WebSocket for session-based payroll collaboration, but no audit feed is exposed over WebSocket.

---

## Proposed Solution

1. **Audit Stream Namespace** (`backend/src/sockets/auditStream.socket.js`): A new Socket.IO namespace (`/audit-stream`) that broadcasts audit log documents to subscribed clients in real time, using a Mongoose Change Stream on the `AuditLog` collection.
2. **Alert Rule Engine** (`backend/src/services/auditAlertRules.service.js`): A rule-evaluator that processes each incoming audit event against a configurable set of alert rules (stored in a new `AlertRule` model) and emits a `COMPLIANCE_ALERT` Socket.IO event when triggered.
3. **Alert Rule Model** (`backend/src/models/alertRule.model.js`): Mongoose schema for storing rule definitions — e.g. `{ field: 'monthlySalary', changeThreshold: 0.3, window: '1h' }`.
4. **Alert Rule Controller & Routes** (`backend/src/controllers/alertRule.controller.js`, `backend/src/routes/alertRule.routes.js`): CRUD endpoints for managing alert rules via the admin panel.
5. **Audit Listener Upgrade** (`backend/src/listeners/audit.listener.js`): Refactor from local EventEmitter to use the MongoDB Change Stream driver, enabling it to work across multiple application instances.
6. **Live Audit Dashboard** (`frontend/src/pages/AuditStream.jsx`): A real-time feed component using Socket.IO client that renders a scrolling log of incoming audit events with severity badges.
7. **Alert Notification Panel** (`frontend/src/components/AlertNotifications.jsx`): A persistent sidebar panel showing triggered compliance alerts with one-click drill-down to the flagged audit record.

---

## Files Affected

- `backend/src/sockets/auditStream.socket.js` — NEW
- `backend/src/services/auditAlertRules.service.js` — NEW
- `backend/src/models/alertRule.model.js` — NEW
- `backend/src/controllers/alertRule.controller.js` — NEW
- `backend/src/routes/alertRule.routes.js` — NEW
- `backend/src/listeners/audit.listener.js` — MAJOR REFACTOR
- `backend/src/app.js` — MODIFY (register audit socket namespace)
- `frontend/src/pages/AuditStream.jsx` — NEW
- `frontend/src/components/AlertNotifications.jsx` — NEW
- `frontend/src/services/socketService.js` — MODIFY (add audit namespace subscription)

---

## Acceptance Criteria

- [ ] Creating a payroll record causes an audit log entry to appear in the `AuditStream` UI within 500ms without a page refresh.
- [ ] A salary increase of more than 30% triggers a `COMPLIANCE_ALERT` event visible in the Alert Notifications panel.
- [ ] The audit stream works across multiple server instances (the Change Stream is attached to MongoDB, not a local EventEmitter).
- [ ] Alert rules can be created, updated, and deleted via the admin panel without a server restart.
- [ ] The live dashboard degrades gracefully when the WebSocket connection is lost (falls back to polling).
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
