# Payroll Reconciliation & Anomaly Resolution Center

This directory contains the services and controllers to manage overrides on suspicious activity alerts triggered by statistical calculations on draft runs.

## System Architecture

1. **Reconciliation Register (`payrollReconciliation.model.js`)**:
   - Stores logs containing the operator ID, target payroll ID, anomaly category, and required textual justification.
   - Serves as the central register of audit exceptions for external tax auditors and compliance scans.

2. **Gated Finalization (`reconciliationGuard.middleware.js`)**:
   - Placed directly in the route declaration of `POST /finalize`.
   - Halts processing with a `422 Unprocessable Entity` if it finds unresolved critical warnings (like duplicate bank details).
   - Allows execution only if a valid reconciliation matches the category.

## Reconciliation API Reference

### Reconcile Anomaly
- **Endpoint**: `POST /api/payroll/reconcile`
- **Body**:
  ```json
  {
    "payrollId": "60d0fe4f5311236168a109a2",
    "anomalyType": "DUPLICATE_BANK_ACCOUNT",
    "justification": "Approved temporary sharing for family members under company policy."
  }
  ```
- **Response**:
  ```json
  {
    "message": "Anomaly reconciled successfully.",
    "reconciliation": {
      "status": "reconciled",
      "anomalyType": "DUPLICATE_BANK_ACCOUNT"
    }
  }
  ```