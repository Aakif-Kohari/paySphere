/**
 * Enterprise Payroll 401(k) Pension & Retirement Compliance Engine Model
 * 
 * Architectural Specifications:
 * - Domain entities for 401(k), Roth 401(k), Safe Harbor 401(k), Pension Annuity, and IRA retirement plans.
 * - IRS statutory limit enforcement: $23,000 elective deferral limit + $7,500 catch-up contribution (age 50+).
 * - Models employer matching formulas (e.g. 100% match on first 3% + 50% match on next 2%).
 * - Non-discrimination testing metrics: ADP (Actual Deferral Percentage) & ACP (Actual Contribution Percentage) for HCE vs NHCE employees.
 *
 * @module PensionRetirementModel
 * @version 7.0.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

export type RetirementPlanType = '401K_TRADITIONAL' | '401K_ROTH' | 'SAFE_HARBOR_401K' | 'DEFINED_BENEFIT_PENSION' | 'SIMPLE_IRA';

export interface EmployeeRetirementProfile {
  employeeId: string;
  fullName: string;
  age: number;
  isHighlyCompensated: boolean; // HCE if compensation > $155,000
  annualSalaryUsd: number;
  planType: RetirementPlanType;
  employeeDeferralPercent: number; // e.g. 6%
  catchUpContributionUsd: number; // Max $7,500 for age 50+
  ytdDeferralUsd: number;
  ytdEmployerMatchUsd: number;
}

export interface PensionMatchResult {
  employeeId: string;
  payPeriodSalaryUsd: number;
  employeeContributionUsd: number;
  employerMatchUsd: number;
  totalPeriodContributionUsd: number;
  statutoryLimitReached: boolean;
  remainingDeferralRoomUsd: number;
}

export interface NonDiscriminationTestResult {
  testType: 'ADP_TEST' | 'ACP_TEST';
  hceAverageDeferralPercent: number;
  nhceAverageDeferralPercent: number;
  maxAllowedHcePercent: number;
  isCompliant: boolean;
  correctiveRefundUsd: number;
}

export class PensionRetirementState {
  private profiles: Map<string, EmployeeRetirementProfile> = new Map();

  constructor() {
    this.loadDefaultProfiles();
  }

  private loadDefaultProfiles(): void {
    const defaultProfiles: EmployeeRetirementProfile[] = [
      {
        employeeId: 'EMP-401K-001',
        fullName: 'Eleanor Vance',
        age: 52,
        isHighlyCompensated: true,
        annualSalaryUsd: 185000,
        planType: '401K_TRADITIONAL',
        employeeDeferralPercent: 8,
        catchUpContributionUsd: 7500,
        ytdDeferralUsd: 14800,
        ytdEmployerMatchUsd: 5550
      },
      {
        employeeId: 'EMP-401K-002',
        fullName: 'Marcus Thorne',
        age: 38,
        isHighlyCompensated: false,
        annualSalaryUsd: 92000,
        planType: '401K_ROTH',
        employeeDeferralPercent: 6,
        catchUpContributionUsd: 0,
        ytdDeferralUsd: 5520,
        ytdEmployerMatchUsd: 3680
      }
    ];

    defaultProfiles.forEach(p => this.profiles.set(p.employeeId, p));
  }

  public getProfiles(): EmployeeRetirementProfile[] {
    return Array.from(this.profiles.values());
  }

  public getProfileById(id: string): EmployeeRetirementProfile | undefined {
    return this.profiles.get(id);
  }
}
