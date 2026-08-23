/**
 * Expatriate Housing & Cost of Living Allowance (COLA) Extensions
 */

export interface ColaAdjustment {
  hostCity: string;
  indexFactor: number; // e.g. 1.25 for Tokyo/London
  adjustedAllowanceUsd: number;
}

export class ExpatriateColaExtensions {
  public static calculateColaAllowance(baseSalaryUsd: number, indexFactor: number): ColaAdjustment {
    const allowance = baseSalaryUsd * (indexFactor - 1.0);
    return {
      hostCity: 'London',
      indexFactor,
      adjustedAllowanceUsd: Number(Math.max(0, allowance).toFixed(2))
    };
  }
}
