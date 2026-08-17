## Summary

PaySphere has no employee-facing self-service surface. Employees cannot view their own payslips, submit investment proofs, raise expense claims, check leave balances, or access offer letters and appointment documents. All of this requires a manager or HR admin to pull records on their behalf. The ccountType: 'EMPLOYEE' path in the auth system exists but leads to no meaningful routes.

## Problem Statement

1. **Dead employee portal**: The RBAC system recognises EMPLOYEE as an account type but the frontend serves only the admin dashboard. An employee who logs in sees the same payroll management tables as their HR admin.
2. **No document vault**: Employment contracts, offer letters, Form 16 PDFs, and payslips are generated and emailed but never stored in a retrievable, permission-scoped document store. If the email bounces or is deleted, the document is permanently lost.
3. **No investment proof submission**: Section 80C/80D/HRA proof collection is manual (email attachments to HR). There is no structured submission with rejection/approval workflow, no deadline enforcement, and no linkage to the TDS recalculation engine.
4. **No e-signature**: Appointment letters and Full-and-Final settlement documents require wet signatures. There is no in-app signing flow.
5. **Salary revision consent**: When a manager revises an employee's CTC, the employee has no channel to acknowledge or dispute it within the system.

## Proposed Implementation

### Backend

- **employeeDocument.model.js** (new): { tenantId, employeeId, type: payslip|offer_letter|form16|contract|investment_proof|other, fileKey (S3/Cloudinary path), originalName, mimeType, uploadedBy, requiresSignature, signedAt, signedByIp, expiresAt, isConfidential }. TTL index on expiresAt for auto-expiry of temporary links.
- **documentVault.service.js** (new):
  - storeDocument(tenantId, employeeId, type, buffer, meta) — uploads to object storage (S3 via @aws-sdk/client-s3 or Cloudinary), stores the document record.
  - getSignedUrl(documentId, requestingEmployeeId, ttlSeconds) — verifies ownership, returns a pre-signed URL valid for 	tlSeconds. Never serves raw S3 URLs.
  - signDocument(documentId, employeeId, signatureData) — stores signedAt and signedByIp; appends an audit log entry; triggers DOCUMENT_SIGNED notification.
- **investmentProof.model.js** (new): { tenantId, employeeId, financialYear, proofType (80C|80D|HRA|80G|other), declaredAmount, documentId, status: draft|submitted|approved|rejected, rejectionReason, reviewedBy, reviewedAt }.
- **investmentProof.controller.js** (new): 
  - POST /api/self/investment-proofs — employee submits a proof (uploads document via documentVault.service, creates proof record).
  - GET /api/self/investment-proofs — employee sees their submission history.
  - PUT /api/admin/investment-proofs/:id/review — HR approves/rejects; on approval triggers TDS recalculation via 	ax.service.js.
- **selfService.controller.js** (new):
  - GET /api/self/documents — employee's document vault listing (payslips, contracts, Form 16s).
  - GET /api/self/documents/:id/download — generates and returns a signed URL.
  - POST /api/self/documents/:id/sign — e-signature endpoint (stores canvas/typed signature hash).
  - GET /api/self/payslips — employee's own payroll history (scoped to employeeId via 	enantScope).
  - GET /api/self/leave-balance — leave balance + accrual summary.
  - POST /api/self/salary-revision/:revisionId/acknowledge — stamps acknowledgement; unacknowledged revisions block the next payroll run.
- **employeePortal.middleware.js** (new): Asserts eq.accountType === 'EMPLOYEE' and that eq.employeeId matches the resource being accessed. Prevents a logged-in employee from fetching another's documents by guessing an ID.

### Frontend

- **EmployeePortal.jsx** (new): Role-aware root layout rendered when ccountType === 'EMPLOYEE'. Sidebar: Dashboard, My Payslips, Documents, Leave, Investment Proofs, Profile.
- **DocumentVault.jsx** (new): Card grid of documents with type icon, upload date, signature status badge, and download button.
- **InvestmentProofWizard.jsx** (new): Multi-step form — select proof type, enter declared amount, upload supporting document, submit. Shows previous submissions and their review status.
- **ESignatureModal.jsx** (new): Canvas-based signature pad (using signature_pad npm package) with typed-signature fallback. Renders document preview (PDF.js iframe) alongside.

## Files Affected

- ackend/src/models/employeeDocument.model.js — new
- ackend/src/models/investmentProof.model.js — new
- ackend/src/services/documentVault.service.js — new
- ackend/src/controllers/selfService.controller.js — new
- ackend/src/controllers/investmentProof.controller.js — new
- ackend/src/middlewares/employeePortal.middleware.js — new
- ackend/src/routes/selfService.routes.js — new
- ackend/src/routes/investmentProof.routes.js — new
- ackend/src/app.js — mount routes
- rontend/src/pages/EmployeePortal.jsx — new
- rontend/src/components/DocumentVault.jsx — new
- rontend/src/components/InvestmentProofWizard.jsx — new
- rontend/src/components/ESignatureModal.jsx — new
- rontend/src/App.jsx — role-based routing

## Acceptance Criteria

- [ ] An EMPLOYEE account can access only /api/self/* routes; accessing /api/employees (admin route) returns 403.
- [ ] GET /api/self/documents/:id/download returns 403 when the requesting employee is not the document owner.
- [ ] POST /api/self/documents/:id/sign stamps signedAt and signedByIp; a second call returns 409 (already signed).
- [ ] Investment proof approval by HR triggers TDS recalculation and dispatches SALARY_CHANGED notification to the employee.
- [ ] Documents stored in S3 are never directly accessible without a valid pre-signed URL; direct object URLs return 403.
- [ ] Salary revision acknowledgement gating: running payroll for a tenant with unacknowledged revisions older than 7 days returns a 422 with a list of affected employees.
