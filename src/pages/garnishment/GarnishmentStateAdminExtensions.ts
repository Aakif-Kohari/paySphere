/**
 * State Specific Garnishment Administrative Fee Extensions
 */

export interface StateAdminFee {
  stateCode: string;
  maxAdminFeeUsd: number; // e.g. $1.50 per pay period in CA/TX
}

export class GarnishmentStateAdminExtensions {
  public static calculateStateAdminFee(stateCode: string): number {
    const fees: Record<string, number> = {
      CA: 1.50,
      TX: 2.00,
      NY: 2.00,
      FL: 5.00
    };
    return fees[stateCode] || 1.00;
  }
}
