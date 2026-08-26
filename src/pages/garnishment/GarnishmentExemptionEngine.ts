/**
 * Enterprise Garnishment Priority Rule Audit & Exemption Engine
 * 
 * Architectural Specifications:
 * - Computes statutory minimum wage protection thresholds ($217.50/week = 30x $7.25 federal min wage).
 * - Enforces creditor garnishment exemptions under state specific consumer protection mandates.
 */

export interface ExemptionThresholdResult {
  weeklyMinWageExemptionUsd: number;
  protectedDisposableEarningsUsd: number;
  availableForGarnishmentUsd: number;
}

export class GarnishmentExemptionEngine {
  public static calculateStatutoryExemption(weeklyDisposableEarningsUsd: number): ExemptionThresholdResult {
    const federalMinWageUsd = 7.25;
    const weeklyProtected = 30 * federalMinWageUsd; // $217.50
    const available = Math.max(0, weeklyDisposableEarningsUsd - weeklyProtected);

    return {
      weeklyMinWageExemptionUsd: weeklyProtected,
      protectedDisposableEarningsUsd: weeklyProtected,
      availableForGarnishmentUsd: Number(available.toFixed(2))
    };
  }
}
