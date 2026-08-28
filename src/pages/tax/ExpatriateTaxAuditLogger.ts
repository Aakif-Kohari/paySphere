/**
 * Global Expatriate Tax Equalization Audit Logger
 */

export interface TaxAuditEntry {
  assignmentId: string;
  action: string;
  timestamp: string;
}

export class ExpatriateTaxAuditLogger {
  public static logAudit(assignmentId: string, action: string): TaxAuditEntry {
    return {
      assignmentId,
      action,
      timestamp: new Date().toISOString()
    };
  }
}
