/**
 * Enterprise Payroll Equity Compensation, ESOP & Stock Options Tax Engine Model
 * 
 * Architectural Specifications:
 * - Domain entities for NSO (Non-Qualified Stock Options), ISO (Incentive Stock Options), RSU (Restricted Stock Units), and ESPP (Employee Stock Purchase Plan).
 * - Tax event modeling: Grant, Vesting, Exercise, Sale/Disposition.
 * - Enforces Statutory Tax Withholding Rules:
 *   - NSO Spread (FMV at Exercise minus Strike Price) taxed as ordinary income + FICA withholding.
 *   - RSU Fair Market Value at vesting taxed as supplemental wages (22% federal flat rate up to $1M, 37% above).
 *   - ISO AMT (Alternative Minimum Tax) preference item tracking at exercise.
 *   - Section 83(b) election tracking for unvested restricted stock grants.
 *
 * @module EquityEsopModel
 * @version 7.3.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

export type EquityGrantType = 'NSO' | 'ISO' | 'RSU' | 'ESPP';

export interface EquityGrant {
  grantId: string;
  employeeId: string;
  employeeName: string;
  grantType: EquityGrantType;
  grantDate: string;
  sharesGranted: number;
  strikePriceUsd: number;
  currentFmvUsd: number; // Fair Market Value
  vestedShares: number;
  hasSection83bElection: boolean;
  supplementalWageRatePercent: number; // Default 22%
}

export interface OptionExerciseTaxResult {
  grantId: string;
  sharesExercised: number;
  strikePriceUsd: number;
  exerciseFmvUsd: number;
  grossSpreadUsd: number; // (FMV - Strike) * Shares
  federalSupplementalTaxUsd: number; // 22% of spread
  ficaMedicareTaxUsd: number; // 1.45%
  ficaSocialSecurityTaxUsd: number; // 6.2% up to wage base
  isoAmtPreferenceItemUsd: number; // Spread for ISOs (no immediate ordinary tax)
  totalPayableWithholdingUsd: number;
  netProceedsOrSharesRemaining: number;
}

export class EquityEsopState {
  private grants: Map<string, EquityGrant> = new Map();

  constructor() {
    this.loadDefaultGrants();
  }

  private loadDefaultGrants(): void {
    const defaultGrants: EquityGrant[] = [
      {
        grantId: 'EQUITY-GRANT-101',
        employeeId: 'EMP-EQ-801',
        employeeName: 'Jonathan Vance',
        grantType: 'NSO',
        grantDate: '2024-01-15',
        sharesGranted: 10000,
        strikePriceUsd: 15.00,
        currentFmvUsd: 45.00,
        vestedShares: 5000,
        hasSection83bElection: false,
        supplementalWageRatePercent: 22
      },
      {
        grantId: 'EQUITY-GRANT-102',
        employeeId: 'EMP-EQ-802',
        employeeName: 'Clara Oswald',
        grantType: 'ISO',
        grantDate: '2024-03-01',
        sharesGranted: 8000,
        strikePriceUsd: 12.50,
        currentFmvUsd: 50.00,
        vestedShares: 4000,
        hasSection83bElection: false,
        supplementalWageRatePercent: 22
      },
      {
        grantId: 'EQUITY-GRANT-103',
        employeeId: 'EMP-EQ-803',
        employeeName: 'David Tennant',
        grantType: 'RSU',
        grantDate: '2025-01-01',
        sharesGranted: 3000,
        strikePriceUsd: 0.00,
        currentFmvUsd: 60.00,
        vestedShares: 1500,
        hasSection83bElection: true,
        supplementalWageRatePercent: 22
      }
    ];

    defaultGrants.forEach(g => this.grants.set(g.grantId, g));
  }

  public getGrants(): EquityGrant[] {
    return Array.from(this.grants.values());
  }

  public getGrantById(id: string): EquityGrant | undefined {
    return this.grants.get(id);
  }
}
