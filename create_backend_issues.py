import subprocess

issues = [
    {
        "title": "Backend: Implement Redis Caching Layer for Reports & Analytics",
        "body": """## Description

Currently, the `/api/reports/analytics` endpoint and payroll summaries query MongoDB synchronously on every request. For organizations with hundreds of employees, these complex aggregations cause significant latency and database strain. 

This issue proposes introducing a Redis caching layer to optimize read-heavy endpoints. We need to build a generic cache service that intercepts read requests and serves them from memory if available.

### Required Architectural Changes:
1. **Cache Service:** Create `backend/src/services/cache.service.js` to handle Redis connections, `get`, `set`, and `del` operations with configurable TTLs.
2. **Controller Updates:** Refactor `reports.controller.js` and `payroll.controller.js` to check the cache before querying MongoDB.
3. **Cache Invalidation:** Implement aggressive cache invalidation inside `employee.controller.js` (on add/update/delete) and `payroll.controller.js` (on finalize) to ensure data consistency.
4. **Middleware:** Optionally, create a `cache.middleware.js` to handle route-level caching.

## Component(s) Affected
* Backend (`server/`)

## Labels
* backend
* enhancement
* performance
"""
    },
    {
        "title": "Backend: Decouple Audit Logging using Event-Driven Architecture",
        "body": """## Description

The current audit logging mechanism in `audit.service.js` is called synchronously within various controllers (e.g., when deleting an account, adding an employee, or finalizing payroll). This tight coupling blocks the main execution thread, adding unnecessary latency to API responses for operations that should be fire-and-forget.

This issue proposes refactoring the audit logging system into an Event-Driven Architecture using Node.js `EventEmitter`.

### Required Architectural Changes:
1. **Event Bus:** Create `backend/src/services/event.service.js` to initialize and export a centralized `EventEmitter`.
2. **Event Listeners:** Create `backend/src/listeners/audit.listener.js` that listens to events like `EMPLOYEE_CREATED`, `PAYROLL_FINALIZED`, and `ACCOUNT_DELETED` to handle database inserts asynchronously.
3. **Controller Refactoring:** Remove synchronous `createAuditLog` calls from `employee.controller.js`, `user.controller.js`, and `payroll.controller.js` and replace them with `eventBus.emit(...)`.
4. **Error Handling:** Ensure the listener has proper error catching so failed audit logs don't crash the server.

## Component(s) Affected
* Backend (`server/`)

## Labels
* backend
* enhancement
* refactor
"""
    },
    {
        "title": "Backend: Implement Comprehensive Role-Based Access Control (RBAC)",
        "body": """## Description

PaySphere currently relies on basic JWT authentication (`auth.middleware.js`) but lacks a granular Role-Based Access Control (RBAC) system. All authenticated users effectively have the same system privileges, which is a security risk for a payroll application.

We need to implement a full RBAC system to differentiate between standard employees, HR managers, and Super Admins.

### Required Architectural Changes:
1. **New Models:** Create `backend/src/models/role.model.js` and `backend/src/models/permission.model.js`. Update `user.model.js` to reference a Role.
2. **RBAC Middleware:** Create `backend/src/middlewares/rbac.middleware.js` that exports a `requirePermission(permissionName)` function.
3. **Route Protection:** Refactor `employee.routes.js`, `payroll.routes.js`, and `reports.routes.js` to inject the new RBAC middleware, strictly scoping endpoints (e.g., only HR can delete employees).
4. **Seeding:** Create a database seed script for default Roles (Admin, HR, Employee) and their respective permissions.

## Component(s) Affected
* Backend (`server/`)

## Labels
* backend
* security
* enhancement
"""
    },
    {
        "title": "Backend: Migrate Payroll Finalization to Background Job Queue (BullMQ)",
        "body": """## Description

The `finalizePayroll` endpoint in `payroll.controller.js` calculates salaries, deductions, and leave adjustments for all employees synchronously in a single HTTP request. As the platform scales, this O(N) operation will inevitably cause API timeouts and server unresponsiveness.

We need to migrate this heavy processing to an asynchronous background job queue.

### Required Architectural Changes:
1. **Queue Setup:** Integrate `bullmq` or a similar Redis-backed queue system in `backend/src/jobs/queue.service.js`.
2. **Worker Implementation:** Create `backend/src/workers/payroll.worker.js` to handle the `calculate_payroll` job outside the main thread.
3. **Controller Refactor:** Modify `finalizePayroll` to dispatch the job to the queue and immediately return a `202 Accepted` with a Job ID.
4. **Status Endpoint:** Create a new route `GET /api/payroll/status/:jobId` so the frontend can poll for completion.

## Component(s) Affected
* Backend (`server/`)

## Labels
* backend
* enhancement
* performance
"""
    },
    {
        "title": "Backend: Offload Report Generation (CSV/PDF) to Worker Threads",
        "body": """## Description

Generating large CSV exports and PDF reports is a highly CPU-bound operation. Currently, `downloadPDFReport` and `exportPayrollCSV` in `reports.controller.js` block the main Node.js event loop, preventing the server from handling other incoming requests while the files are being constructed.

This issue aims to offload CPU-intensive report generation to Node.js `worker_threads`.

### Required Architectural Changes:
1. **Export Service:** Create `backend/src/services/export.service.js` that utilizes the `worker_threads` module.
2. **Worker Scripts:** Create `backend/src/workers/pdf.worker.js` and `csv.worker.js` to handle the actual data formatting, PDF drawing (e.g., pdfkit), and CSV stringification.
3. **Controller Refactoring:** Update `reports.controller.js` to pass the raw data payload to the worker threads and wait for the resolved buffer to stream back to the client.
4. **Memory Management:** Ensure the workers properly terminate and avoid memory leaks.

## Component(s) Affected
* Backend (`server/`)

## Labels
* backend
* enhancement
* performance
"""
    }
]

for idx, issue in enumerate(issues):
    print(f"Creating Issue {idx+1}...")
    try:
        subprocess.run(
            ["gh", "issue", "create", "--repo", "Dev1822/paySphere", "--title", issue["title"], "--body", issue["body"]],
            check=True
        )
        print(f"Issue {idx+1} created successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Failed to create Issue {idx+1}: {e}")
