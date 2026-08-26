/**
 * SOX 404 Segregation of Duties (SoD) Rule Engine
 */

export interface SodConflictCheck {
  actorUserId: string;
  hasConflict: boolean;
  conflictReason?: string;
}

export class SodComplianceEngine {
  public static checkSegregationOfDuties(
    initiatorUserId: string,
    approverUserId: string
  ): SodConflictCheck {
    const hasConflict = initiatorUserId === approverUserId;
    return {
      actorUserId: initiatorUserId,
      hasConflict,
      conflictReason: hasConflict ? 'Self-approval violation: Initiator cannot approve own payroll adjustment' : undefined
    };
  }
}
