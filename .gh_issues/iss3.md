## Summary

There is no way to onboard more than one employee at a time. Every new hire requires navigating the employee creation form individually. Large enterprises joining PaySphere need to import hundreds of employees from their existing HRMS CSV exports. The existing csv.worker.js is export-only (36 lines, payroll data only) and has no import counterpart.

## Problem Statement

1. **No bulk import path**: There is no POST /api/employees/import endpoint. HR teams resort to manually creating employees one by one, taking hours for companies with 200+ staff.
2. **No validation pipeline**: Raw CSV imports across payroll tools typically fail with silent data corruption — wrong column order, duplicate employee IDs, invalid department names, salary values with currency symbols. There is no schema validation step before records hit the database.
3. **No preview / dry-run**: The user must commit the import to find out what is wrong. If row 187 has an invalid PAN number, all 186 preceding records have already been saved and must be manually deleted.
4. **No rollback**: If an import partially succeeds (rows 1-150 saved, row 151 throws), the tenant database is left in a half-imported state with no mechanism to undo.
5. **Streaming gap**: csv.worker.js loads the entire payload into memory. A 10,000-row CSV will OOM the worker on a budget VPS.

## Proposed Implementation

### Backend

- **csvImport.worker.js** (new): Worker-thread-based streaming CSV parser using csv-parse in streaming mode. Emits { row, errors[] } messages to the parent port. Processes in chunks of 100 to keep peak memory bounded.
- **employeeImport.service.js** (new):
  - alidateRow(row, existingEmails, existingEmployeeIds) — per-row schema validation (required fields, type coercion, PAN regex, IFSC regex, department existence). Returns { valid, errors[] }.
  - importBatch(rows, tenantId, session) — bulk insertMany within a Mongoose session for atomic rollback.
  - ollbackImport(importBatchId) — deletes all Employee documents tagged with the batch ID.
- **employeeImport.model.js** (new): Tracks each import job: 	enantId, status (pending|validating|preview_ready|importing|done|failed|rolled_back), 	otalRows, alidRows, errorRows, errors[] (row + message), importedEmployeeIds[], createdBy, timestamps.
- **employeeImport.controller.js** (new): 
  - POST /api/employees/import — accepts multipart CSV, spawns worker, returns importJobId.
  - GET /api/employees/import/:jobId — polls job status and validation summary.
  - POST /api/employees/import/:jobId/commit — triggers importBatch after user confirms preview.
  - DELETE /api/employees/import/:jobId — calls ollbackImport.
- **Column mapping**: Accept a mapping JSON field alongside the CSV so HR can specify which CSV column maps to which schema field (e.g., { "Full Name": "fullName", "Dept": "department" }).

### Frontend

- **BulkImport.jsx** (new): Multi-step wizard — (1) Upload + column mapping, (2) Validation preview table (green/red rows, error tooltip), (3) Confirm commit or Fix errors, (4) Progress bar during import, (5) Summary with rollback button.
- **ImportHistory.jsx** (new): Table of past imports with status, row counts, and rollback action.

## Files Affected

- ackend/src/workers/csvImport.worker.js — new
- ackend/src/models/employeeImport.model.js — new
- ackend/src/services/employeeImport.service.js — new
- ackend/src/controllers/employeeImport.controller.js — new
- ackend/src/routes/employeeImport.routes.js — new
- ackend/src/app.js — mount route
- rontend/src/pages/Employees.jsx — add import entry point
- rontend/src/components/BulkImport.jsx — new
- rontend/src/components/ImportHistory.jsx — new

## Acceptance Criteria

- [ ] A 5,000-row CSV is parsed and validated without exceeding 150MB worker memory.
- [ ] Rows with invalid PAN, duplicate email, or missing required fields appear in the preview with row number and specific error message; valid rows proceed.
- [ ] POST /api/employees/import/:jobId/commit is atomic: if any insertMany chunk fails the Mongoose session rolls back and no partial data persists.
- [ ] DELETE /api/employees/import/:jobId removes all employees tagged with the batch ID and sets status to olled_back.
- [ ] Column mapping allows arbitrary CSV column names mapped to schema fields; unmapped required fields produce a validation error before any rows are processed.
