/**
 * Enterprise Global Mobility & Tax Equalization Service Engine.
 * Calculates hypothetical tax deductions, models host-home tax differential liability,
 * applies bilateral tax treaty provisions, and processes year-end reconciliation settlements.
 */

const EnterpriseTaxEqualization = require('../models/EnterpriseTaxEqualizationModel');

class TaxEqualizationService {
  /**
   * Calculates Hypothetical Tax (Hypo Tax) deduction per pay-period.
   * Formula: Hypo Tax = Base Salary * Hypothetical Home Tax Rate
   */
  static calculateHypoTaxDeduction(baseSalary, hypoTaxRatePercentage) {
    const annualHypo = (baseSalary * hypoTaxRatePercentage) / 100;
    return parseFloat((annualHypo / 12).toFixed(2));
  }

  /**
   * Calculates net tax equalization differential between host actual liability and home hypo tax.
   */
  static calculateEqualizationDifferential(baseSalary, allowances, homeHypoRate, hostActualRate) {
    const totalCompensation = baseSalary + allowances;
    const hypoTax = (baseSalary * homeHypoRate) / 100;
    const hostTaxLiability = (totalCompensation * hostActualRate) / 100;

    // Company pays host tax; employee pays hypo tax. Differential = Host Tax - Hypo Tax
    return parseFloat((hostTaxLiability - hypoTax).toFixed(2));
  }

  /**
   * Enrolls an expatriate employee into the tax equalization program.
   */
  static async enrollExpatriate(profileData) {
    const differential = this.calculateEqualizationDifferential(
      profileData.annualBaseSalaryUsd,
      profileData.annualExpatAllowancesUsd || 0,
      profileData.hypotheticalTaxPercentage,
      profileData.actualHostTaxRatePercentage
    );

    const newProfile = new EnterpriseTaxEqualization({
      profileId: `TAX-EQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      ...profileData,
      equalizationDifferentialBalanceUsd: differential,
      profileStatus: 'ACTIVE_ASSIGNMENT',
    });

    return await newProfile.save();
  }

  /**
   * Processes a year-end tax reconciliation settlement.
   */
  static async processTaxReconciliation(profileId, actualReconciledDifferentialUsd) {
    const profile = await EnterpriseTaxEqualization.findOne({ profileId });
    if (!profile) {
      throw new Error(`Tax equalization profile ${profileId} not found.`);
    }

    const type = actualReconciledDifferentialUsd > 0 ? 'COMPANY_OWES_EMPLOYEE' : 'EMPLOYEE_OWES_COMPANY';

    const settlementRecord = {
      settlementId: `SETTLE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      settlementType: type,
      amountUsd: Math.abs(actualReconciledDifferentialUsd),
      settlementStatus: 'SETTLED',
      referenceTransactionId: `TX-EQ-${Math.floor(100000 + Math.random() * 900000)}`,
    };

    profile.equalizationDifferentialBalanceUsd = actualReconciledDifferentialUsd;
    profile.settlements.push(settlementRecord);
    profile.profileStatus = 'ACTIVE_ASSIGNMENT';

    return await profile.save();
  }
}

module.exports = TaxEqualizationService;
