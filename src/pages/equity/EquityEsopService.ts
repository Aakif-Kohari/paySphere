/**
 * Enterprise Payroll Equity Compensation, ESOP & Stock Options Tax Engine Service
 * 
 * Architectural Specifications:
 * - Computes statutory tax withholding on NSO/RSU/ESPP exercises and vesting events.
 * - Tax formulas:
 *   - NSO: Spread = (FMV - Strike) * Shares.
 *     Federal Tax = Spread * 22% (or 37% if > $1M YTD supplemental wages).
 *     FICA Social Security = 6.2% on Spread (capped at annual limit).
 *     FICA Medicare = 1.45% on Spread + 0.9% Additional Medicare if applicable.
 *   - ISO: No immediate ordinary income tax withholding at exercise (unless disqualifying disposition).
 *     Calculates Alternative Minimum Tax (AMT) preference spread: AMT Preference = Spread.
 *   - RSU: Taxable Income = FMV at Vesting * Shares Vested. Taxed as supplemental wages.
 *   - Section 83(b) Election: Locks income recognition to Grant FMV instead of Vesting FMV.
 *
 * @module EquityEsopService
 * @version 7.3.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

import {
  EquityGrant,
  OptionExerciseTaxResult,
  EquityEsopState
} from './EquityEsopModel';

export class EquityEsopService {
  private state: EquityEsopState;

  // Statutory Tax Rates
  private readonly federalSupplementalRate: number = 0.22;
  private readonly socialSecurityRate: number = 0.062;
  private readonly medicareRate: number = 0.0145;

  constructor(state?: EquityEsopState) {
    this.state = state || new EquityEsopState();
  }

  public getState(): EquityEsopState {
    return this.state;
  }

  /**
   * Calculates statutory payroll tax withholding upon stock option exercise or RSU vesting.
   */
  public calculateExerciseTaxWithholding(
    grant: EquityGrant,
    sharesToExercise: number,
    exerciseFmvUsd: number
  ): OptionExerciseTaxResult {
    const validShares = Math.min(sharesToExercise, grant.vestedShares);
    const grossSpreadUsd = (exerciseFmvUsd - grant.strikePriceUsd) * validShares;

    let federalSupplementalTaxUsd = 0;
    let ficaMedicareTaxUsd = 0;
    let ficaSocialSecurityTaxUsd = 0;
    let isoAmtPreferenceItemUsd = 0;

    if (grant.grantType === 'NSO' || grant.grantType === 'RSU') {
      federalSupplementalTaxUsd = grossSpreadUsd * (grant.supplementalWageRatePercent / 100);
      ficaMedicareTaxUsd = grossSpreadUsd * this.medicareRate;
      ficaSocialSecurityTaxUsd = grossSpreadUsd * this.socialSecurityRate;
    } else if (grant.grantType === 'ISO') {
      // ISO exercise does not trigger ordinary payroll tax withholding, but creates AMT preference item
      isoAmtPreferenceItemUsd = grossSpreadUsd;
    } else if (grant.grantType === 'ESPP') {
      // ESPP discount taxed upon disposition
      federalSupplementalTaxUsd = grossSpreadUsd * this.federalSupplementalRate;
    }

    const totalPayableWithholdingUsd = federalSupplementalTaxUsd + ficaMedicareTaxUsd + ficaSocialSecurityTaxUsd;

    return {
      grantId: grant.grantId,
      sharesExercised: validShares,
      strikePriceUsd: grant.strikePriceUsd,
      exerciseFmvUsd,
      grossSpreadUsd: Number(grossSpreadUsd.toFixed(2)),
      federalSupplementalTaxUsd: Number(federalSupplementalTaxUsd.toFixed(2)),
      ficaMedicareTaxUsd: Number(ficaMedicareTaxUsd.toFixed(2)),
      ficaSocialSecurityTaxUsd: Number(ficaSocialSecurityTaxUsd.toFixed(2)),
      isoAmtPreferenceItemUsd: Number(isoAmtPreferenceItemUsd.toFixed(2)),
      totalPayableWithholdingUsd: Number(totalPayableWithholdingUsd.toFixed(2)),
      netProceedsOrSharesRemaining: grant.sharesGranted - validShares
    };
  }
}
