const {
  computeGratuityAccrual,
  generateActuarialValuationSummary,
  generateGratuityJournalEntry,
  STATUTORY_GRATUITY_CEILING,
  VESTING_YEARS_MANDATE,
} = require('../gratuityFundEngine.utils');

describe('gratuityFundEngine.utils - Statutory Gratuity & Actuarial Engine', () => {
  describe('computeGratuityAccrual', () => {
    it('calculates statutory 15/26 formula for 5-year vested employee', () => {
      const basic = 52000;
      const da = 0; // Wages = 52000
      const months = 60; // Exactly 5 years
      const result = computeGratuityAccrual(basic, da, months, false);

      expect(result.wages).toBe(52000);
      expect(result.completedYears).toBe(5);
      expect(result.isVested).toBe(true);
      // (15 * 52000 * 5) / 26 = 150,000
      expect(result.accruedGratuity).toBe(150000);
      expect(result.contingentLiability).toBe(0);
    });

    it('rounds up partial years with >= 6 months service', () => {
      const basic = 52000;
      const da = 0;
      const months = 67; // 5 years and 7 months -> rounded to 6 years
      const result = computeGratuityAccrual(basic, da, months, false);

      expect(result.completedYears).toBe(6);
      expect(result.isVested).toBe(true);
      // (15 * 52000 * 6) / 26 = 180,000
      expect(result.accruedGratuity).toBe(180000);
    });

    it('treats tenure < 5 years as unvested contingent liability', () => {
      const basic = 52000;
      const da = 0;
      const months = 40; // 3 years and 4 months (< 5 years)
      const result = computeGratuityAccrual(basic, da, months, false);

      expect(result.isVested).toBe(false);
      expect(result.accruedGratuity).toBe(0);
      expect(result.contingentLiability).toBe(90000); // (15 * 52000 * 3) / 26
    });

    it('caps gratuity accrual at ₹20 Lakh statutory ceiling', () => {
      const basic = 500000; // High wage earner
      const da = 50000;
      const months = 300; // 25 years
      const result = computeGratuityAccrual(basic, da, months, false);

      expect(result.accruedGratuity).toBe(STATUTORY_GRATUITY_CEILING); // 20,00,000 max
    });

    it('accelerates vesting for exceptional cases (death/disability)', () => {
      const basic = 52000;
      const da = 0;
      const months = 24; // 2 years
      const result = computeGratuityAccrual(basic, da, months, true);

      expect(result.isVested).toBe(true);
      expect(result.accruedGratuity).toBe(60000);
    });
  });

  describe('generateActuarialValuationSummary', () => {
    it('aggregates organization-wide liability and quarterly provision requirements', () => {
      const employees = [
        { basic: 52000, da: 0, serviceMonths: 60 }, // Vested: 150000
        { basic: 52000, da: 0, serviceMonths: 72 }, // Vested: 180000
        { basic: 52000, da: 0, serviceMonths: 24 }, // Unvested: 60000 contingent
      ];

      const summary = generateActuarialValuationSummary(employees, 0.0725);

      expect(summary.totalHeadcount).toBe(3);
      expect(summary.totalVestedLiability).toBe(330000);
      expect(summary.totalContingentLiability).toBe(60000);
      expect(summary.quarterlyProvisionRequirement).toBe(Math.round(330000 / 4));
    });
  });

  describe('generateGratuityJournalEntry', () => {
    it('creates balanced double-entry accounting journal', () => {
      const journal = generateGratuityJournalEntry('2026-Q3', 82500);

      expect(journal.isBalanced).toBe(true);
      expect(journal.entries[0].debit).toBe(82500);
      expect(journal.entries[1].credit).toBe(82500);
      expect(journal.entries[0].accountCode).toBe('EXP-6040');
      expect(journal.entries[1].accountCode).toBe('LIAB-2040');
    });
  });
});
