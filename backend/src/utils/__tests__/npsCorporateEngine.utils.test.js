const {
  computeCorporateNpsContribution,
  simulateNpsTaxSavings,
  generatePranBatchRemittanceItem,
  MAX_CORPORATE_NPS_PERCENT_PRIVATE,
  MAX_CORPORATE_NPS_PERCENT_GOV,
} = require('../npsCorporateEngine.utils');

describe('npsCorporateEngine.utils - Corporate NPS & Section 80CCD(2) Engine', () => {
  describe('computeCorporateNpsContribution', () => {
    it('computes 10% corporate NPS contribution for private sector', () => {
      const basic = 100000;
      const da = 20000; // Wages = 120000
      const result = computeCorporateNpsContribution(basic, da, 10, false);

      expect(result.eligibleWages).toBe(120000);
      expect(result.effectivePercent).toBe(10);
      expect(result.monthlyContribution).toBe(12000);
      expect(result.annualContribution).toBe(144000);
      expect(result.maxPermissiblePercent).toBe(MAX_CORPORATE_NPS_PERCENT_PRIVATE);
    });

    it('caps corporate NPS contribution at 10% for private sector even if higher elected', () => {
      const basic = 50000;
      const result = computeCorporateNpsContribution(basic, 0, 20, false);

      expect(result.effectivePercent).toBe(10);
      expect(result.monthlyContribution).toBe(5000);
    });

    it('permits up to 14% for government sector employees', () => {
      const basic = 50000;
      const result = computeCorporateNpsContribution(basic, 0, 14, true);

      expect(result.effectivePercent).toBe(14);
      expect(result.monthlyContribution).toBe(7000);
      expect(result.maxPermissiblePercent).toBe(MAX_CORPORATE_NPS_PERCENT_GOV);
    });
  });

  describe('simulateNpsTaxSavings', () => {
    it('calculates annual tax savings and monthly net take-home reduction', () => {
      const annualBasic = 1200000;
      const result = simulateNpsTaxSavings(annualBasic, 10, 0.312); // 31.2% tax rate

      expect(result.annualNpsContribution).toBe(120000); // 10% of 12L
      expect(result.annualTaxSaved).toBe(Math.round(120000 * 0.312)); // 37440
      expect(result.annualTakeHomeReduction).toBe(120000 - 37440); // 82560
      expect(result.monthlyTaxSaved).toBe(Math.round(37440 / 12));
    });
  });

  describe('generatePranBatchRemittanceItem', () => {
    it('formats valid 12-digit PRAN record', () => {
      const item = generatePranBatchRemittanceItem('EMP-01', '123456789012', 'Priya Sharma', 10000, 0, 8, 2026);

      expect(item.isValidPran).toBe(true);
      expect(item.pranNumber).toBe('123456789012');
      expect(item.employerTier1Contribution).toBe(10000);
      expect(item.totalNpsRemitted).toBe(10000);
    });

    it('flags invalid PRAN numbers', () => {
      const item = generatePranBatchRemittanceItem('EMP-02', '12345', 'John Doe', 5000, 0, 8, 2026);
      expect(item.isValidPran).toBe(false);
    });
  });
});
