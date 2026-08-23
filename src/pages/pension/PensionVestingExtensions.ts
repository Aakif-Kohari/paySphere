/**
 * Enterprise 401(k) Pension Vesting Schedule & Loans Extensions
 */

export interface VestingSchedule {
  yearsOfService: number;
  vestedPercent: number; // e.g. 20% per year graded vesting
}

export class PensionVestingExtensions {
  public static calculateVestedBalance(
    employerMatchUsd: number,
    yearsOfService: number
  ): number {
    let vestedPercent = 0;
    if (yearsOfService >= 5) vestedPercent = 100;
    else if (yearsOfService >= 4) vestedPercent = 80;
    else if (yearsOfService >= 3) vestedPercent = 60;
    else if (yearsOfService >= 2) vestedPercent = 40;
    else if (yearsOfService >= 1) vestedPercent = 20;

    return Number((employerMatchUsd * (vestedPercent / 100)).toFixed(2));
  }
}
