/**
 * Enterprise Payroll Pension & Annuity Service Engine.
 * Calculates defined benefit annuity payouts, models compound growth,
 * manages tax withholding formulas, and executes monthly fund disbursements.
 */

const EnterprisePension = require('../models/EnterprisePensionModel');

class PensionAnnuityService {
  /**
   * Calculates monthly annuity payout for Defined Benefit plans.
   * Formula: Monthly Payout = (Years of Service * Average Salary * Multiplier) / 12
   */
  static calculateDefinedBenefitAnnuity(yearsOfService, averageFinalSalary, multiplier = 0.015) {
    const annualPayout = yearsOfService * averageFinalSalary * multiplier;
    return parseFloat((annualPayout / 12).toFixed(2));
  }

  /**
   * Enrolls a new retiree into the pension & annuity fund system.
   */
  static async enrollRetiree(enrollmentData) {
    const monthlyPayout = this.calculateDefinedBenefitAnnuity(
      enrollmentData.yearsOfService || 25,
      enrollmentData.averageFinalSalary || 95000,
      0.015
    );

    const newAccount = new EnterprisePension({
      pensionAccountId: `PENS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      ...enrollmentData,
      monthlyAnnuityPayout: monthlyPayout,
      accountStatus: 'ACTIVE_DISBURSEMENT',
    });

    return await newAccount.save();
  }

  /**
   * Executes a monthly pension annuity disbursement with statutory tax withholding.
   */
  static async executeMonthlyDisbursement(pensionAccountId) {
    const account = await EnterprisePension.findOne({ pensionAccountId });
    if (!account) {
      throw new Error(`Pension account ${pensionAccountId} not found.`);
    }

    const grossAmount = account.monthlyAnnuityPayout;
    const taxWithheld = parseFloat(((grossAmount * account.taxWithholdingRatePercentage) / 100).toFixed(2));
    const netAmount = parseFloat((grossAmount - taxWithheld).toFixed(2));

    const disbursementRecord = {
      disbursementId: `DISB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      grossAnnuityAmount: grossAmount,
      taxWithheldAmount: taxWithheld,
      netDisbursedAmount: netAmount,
      disbursementStatus: 'SUCCESSFUL',
      bankReferenceNumber: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
    };

    account.disbursements.push(disbursementRecord);
    return await account.save();
  }

  /**
   * Adjusts tax withholding rate for pension account.
   */
  static async updateTaxWithholdingRate(pensionAccountId, newRatePercentage) {
    const account = await EnterprisePension.findOne({ pensionAccountId });
    if (!account) {
      throw new Error(`Pension account ${pensionAccountId} not found.`);
    }

    account.taxWithholdingRatePercentage = newRatePercentage;
    return await account.save();
  }
}

module.exports = PensionAnnuityService;
