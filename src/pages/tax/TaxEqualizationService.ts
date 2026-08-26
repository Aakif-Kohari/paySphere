/**
 * Enterprise Payroll Global Tax Equalization & Expatriate Mobility Service Engine
 * 
 * Architectural Specifications:
 * - Computes Hypothetical Tax (HTAX) deduction: HTAX = Base Salary * Hypothetical Tax Rate.
 * - Computes Grossed-Up Host Country Tax Liability:
 *   Host Taxable Base = Base Salary + Expatriate Allowances - Foreign Earned Income Exclusion (FEIE).
 *   Host Tax Liability = Host Taxable Base * Host Country Tax Rate.
 * - Tax Equalization Balancing:
 *   If Host Tax Liability > HTAX, Employer pays Gross-Up Adjustment = Host Tax Liability - HTAX.
 *   If Host Tax Liability < HTAX, Employer retains tax windfall benefit.
 *
 * @module TaxEqualizationService
 * @version 7.2.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

import {
  ExpatriateAssignment,
  TaxEqualizationCalculationResult,
  TaxEqualizationState
} from './TaxEqualizationModel';

export class TaxEqualizationService {
  private state: TaxEqualizationState;

  constructor(state?: TaxEqualizationState) {
    this.state = state || new TaxEqualizationState();
  }

  public getState(): TaxEqualizationState {
    return this.state;
  }

  /**
   * Computes tax equalization metrics for an expatriate assignment.
   */
  public calculateTaxEqualization(assignment: ExpatriateAssignment): TaxEqualizationCalculationResult {
    const grossPackageUsd = assignment.baseSalaryUsd + assignment.expatriateAllowancesUsd;

    // 1. Hypothetical Tax (HTAX) - stay at home tax burden
    const hypotheticalTaxDeductionUsd = assignment.baseSalaryUsd * (assignment.hypotheticalTaxRatePercent / 100);

    // 2. Host Country Tax Base & Liability
    const hostTaxableBaseUsd = Math.max(0, grossPackageUsd - assignment.foreignEarnedIncomeExclusionUsd);
    const actualHostTaxLiabilityUsd = hostTaxableBaseUsd * (assignment.hostCountryTaxRatePercent / 100);

    // 3. Employer Gross-Up Adjustment
    // Employer absorbs tax differential between actual host tax and employee's hypothetical tax
    let employerTaxGrossUpAdjustmentUsd = 0;
    if (actualHostTaxLiabilityUsd > hypotheticalTaxDeductionUsd) {
      employerTaxGrossUpAdjustmentUsd = actualHostTaxLiabilityUsd - hypotheticalTaxDeductionUsd;
    }

    // 4. Net Expatriate Take-Home Pay
    // Employee receives Base Salary + Allowances - Hypothetical Tax
    const netExpatriateTakeHomeUsd = grossPackageUsd - hypotheticalTaxDeductionUsd;

    // 5. Total Employer Cost
    const effectiveTaxEqualizationCostUsd = grossPackageUsd + employerTaxGrossUpAdjustmentUsd;

    return {
      assignmentId: assignment.assignmentId,
      grossPackageUsd: Number(grossPackageUsd.toFixed(2)),
      hypotheticalTaxDeductionUsd: Number(hypotheticalTaxDeductionUsd.toFixed(2)),
      actualHostTaxLiabilityUsd: Number(actualHostTaxLiabilityUsd.toFixed(2)),
      employerTaxGrossUpAdjustmentUsd: Number(employerTaxGrossUpAdjustmentUsd.toFixed(2)),
      netExpatriateTakeHomeUsd: Number(netExpatriateTakeHomeUsd.toFixed(2)),
      effectiveTaxEqualizationCostUsd: Number(effectiveTaxEqualizationCostUsd.toFixed(2))
    };
  }
}
