/**
 * Enterprise Payroll 401(k) Pension & Retirement Compliance Engine Service
 * 
 * Architectural Specifications:
 * - IRS statutory 2026 limits: $23,000 max elective deferral + $7,500 catch-up contribution for age 50+.
 * - Tiered Employer Matching Formula:
 *   - 100% match on first 3% of salary deferred
 *   - 50% match on next 2% of salary deferred (Maximum 4% total employer match on 5% deferral)
 * - Conducts non-discrimination ADP (Actual Deferral Percentage) testing between HCE (Highly Compensated) and NHCE groups:
 *   Rule: HCE ADP cannot exceed NHCE ADP + 2% (or 2x NHCE ADP, whichever is lower).
 *
 * @module PensionRetirementService
 * @version 7.0.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

import {
  EmployeeRetirementProfile,
  PensionMatchResult,
  NonDiscriminationTestResult,
  PensionRetirementState
} from './PensionRetirementModel';

export class PensionRetirementService {
  private state: PensionRetirementState;

  // IRS 2026 Statutory Limits
  private readonly irsElectiveDeferralLimitUsd: number = 23000;
  private readonly irsCatchUpLimitUsd: number = 7500;

  constructor(state?: PensionRetirementState) {
    this.state = state || new PensionRetirementState();
  }

  public getState(): PensionRetirementState {
    return this.state;
  }

  /**
   * Calculates pay period 401(k) employee contribution and employer match.
   */
  public calculatePayPeriodMatch(
    profile: EmployeeRetirementProfile,
    payPeriodSalaryUsd: number
  ): PensionMatchResult {
    const maxDeferralAllowedUsd = profile.age >= 50
      ? this.irsElectiveDeferralLimitUsd + profile.catchUpContributionUsd
      : this.irsElectiveDeferralLimitUsd;

    const remainingRoomUsd = Math.max(0, maxDeferralAllowedUsd - profile.ytdDeferralUsd);

    // Desired employee contribution for pay period
    let desiredContributionUsd = payPeriodSalaryUsd * (profile.employeeDeferralPercent / 100);
    let statutoryLimitReached = false;

    if (desiredContributionUsd > remainingRoomUsd) {
      desiredContributionUsd = remainingRoomUsd;
      statutoryLimitReached = true;
    }

    // Tiered Employer Match Calculation:
    // 100% on first 3% salary + 50% on next 2% salary
    const deferralRate = profile.employeeDeferralPercent / 100;
    let matchRate = 0;

    if (deferralRate > 0) {
      const tier1 = Math.min(deferralRate, 0.03);
      const tier2 = Math.min(Math.max(0, deferralRate - 0.03), 0.02);
      matchRate = tier1 * 1.0 + tier2 * 0.5; // Max 0.04 (4%)
    }

    const employerMatchUsd = payPeriodSalaryUsd * matchRate;

    return {
      employeeId: profile.employeeId,
      payPeriodSalaryUsd,
      employeeContributionUsd: Number(desiredContributionUsd.toFixed(2)),
      employerMatchUsd: Number(employerMatchUsd.toFixed(2)),
      totalPeriodContributionUsd: Number((desiredContributionUsd + employerMatchUsd).toFixed(2)),
      statutoryLimitReached,
      remainingDeferralRoomUsd: Number((remainingRoomUsd - desiredContributionUsd).toFixed(2))
    };
  }

  /**
   * Evaluates IRS ADP Non-Discrimination Compliance Test for HCE vs NHCE groups.
   */
  public evaluateAdpNonDiscriminationTest(profiles: EmployeeRetirementProfile[]): NonDiscriminationTestResult {
    const hces = profiles.filter(p => p.isHighlyCompensated);
    const nhces = profiles.filter(p => !p.isHighlyCompensated);

    const hceAveragePercent = hces.length > 0
      ? hces.reduce((acc, curr) => acc + curr.employeeDeferralPercent, 0) / hces.length
      : 0;

    const nhceAveragePercent = nhces.length > 0
      ? nhces.reduce((acc, curr) => acc + curr.employeeDeferralPercent, 0) / nhces.length
      : 0;

    // Allowed HCE ADP: Lesser of (NHCE + 2%) or (NHCE * 2)
    const maxAllowedHcePercent = Math.min(nhceAveragePercent + 2.0, nhceAveragePercent * 2.0);
    const isCompliant = hceAveragePercent <= maxAllowedHcePercent;

    let correctiveRefundUsd = 0;
    if (!isCompliant && hces.length > 0) {
      const excessPercent = hceAveragePercent - maxAllowedHcePercent;
      const totalHceSalary = hces.reduce((acc, curr) => acc + curr.annualSalaryUsd, 0);
      correctiveRefundUsd = totalHceSalary * (excessPercent / 100);
    }

    return {
      testType: 'ADP_TEST',
      hceAverageDeferralPercent: Number(hceAveragePercent.toFixed(2)),
      nhceAverageDeferralPercent: Number(nhceAveragePercent.toFixed(2)),
      maxAllowedHcePercent: Number(maxAllowedHcePercent.toFixed(2)),
      isCompliant,
      correctiveRefundUsd: Number(correctiveRefundUsd.toFixed(2))
    };
  }
}
