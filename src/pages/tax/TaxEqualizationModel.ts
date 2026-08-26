/**
 * Enterprise Payroll Global Tax Equalization & Expatriate Mobility Model
 * 
 * Architectural Specifications:
 * - Domain entities for expatriate tax equalization (TEQ) policies, hypothetical tax calculations, host country tax liabilities, and employer tax gross-up adjustments.
 * - HTAX (Hypothetical Tax) deduction modeling to ensure expatriates pay no more and no less tax than if they remained in their home country.
 * - Supports double taxation treaty relief credits (FEIE - Foreign Earned Income Exclusion, FTC - Foreign Tax Credit).
 *
 * @module TaxEqualizationModel
 * @version 7.2.0
 * @author Enterprise Payroll Compliance Architecture Team
 */

export interface ExpatriateAssignment {
  assignmentId: string;
  employeeId: string;
  fullName: string;
  homeCountry: string; // e.g. US
  hostCountry: string; // e.g. UK, SG, DE
  baseSalaryUsd: number;
  expatriateAllowancesUsd: number; // Housing, COLA, Relocation
  hypotheticalTaxRatePercent: number; // Home country stay-at-home tax rate
  hostCountryTaxRatePercent: number; // Host country local tax rate
  foreignEarnedIncomeExclusionUsd: number; // e.g. $126,500 FEIE
}

export interface TaxEqualizationCalculationResult {
  assignmentId: string;
  grossPackageUsd: number;
  hypotheticalTaxDeductionUsd: number;
  actualHostTaxLiabilityUsd: number;
  employerTaxGrossUpAdjustmentUsd: number;
  netExpatriateTakeHomeUsd: number;
  effectiveTaxEqualizationCostUsd: number;
}

export class TaxEqualizationState {
  private assignments: Map<string, ExpatriateAssignment> = new Map();

  constructor() {
    this.loadDefaultAssignments();
  }

  private loadDefaultAssignments(): void {
    const defaultList: ExpatriateAssignment[] = [
      {
        assignmentId: 'EXP-TEQ-001',
        employeeId: 'EMP-EXP-501',
        fullName: 'Alexander Wright',
        homeCountry: 'US',
        hostCountry: 'UK',
        baseSalaryUsd: 180000,
        expatriateAllowancesUsd: 45000, // $45,000 housing & COLA
        hypotheticalTaxRatePercent: 24, // 24% US hypothetical tax
        hostCountryTaxRatePercent: 40, // 40% UK higher rate tax
        foreignEarnedIncomeExclusionUsd: 126500
      },
      {
        assignmentId: 'EXP-TEQ-002',
        employeeId: 'EMP-EXP-502',
        fullName: 'Sophia Chen',
        homeCountry: 'US',
        hostCountry: 'SG',
        baseSalaryUsd: 210000,
        expatriateAllowancesUsd: 35000,
        hypotheticalTaxRatePercent: 28,
        hostCountryTaxRatePercent: 18, // 18% Singapore lower rate
        foreignEarnedIncomeExclusionUsd: 126500
      }
    ];

    defaultList.forEach(a => this.assignments.set(a.assignmentId, a));
  }

  public getAssignments(): ExpatriateAssignment[] {
    return Array.from(this.assignments.values());
  }
}
