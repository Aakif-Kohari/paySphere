'use strict';

const TaxService = require('../tax.service');

describe('TaxService', () => {
  it('should return nothingOwed for invalid or zero gross income', async () => {
    const result = await TaxService.calculateTax('66b1a2b3c4d5e6f7a8b9c0d1', 'IN', 0);
    expect(result.totalTax).toBe(0);
    expect(result.configured).toBe(false);
  });

  it('should return nothingOwed when tenant ID is missing or invalid', async () => {
    const result = await TaxService.calculateTax(null, 'US', 50000);
    expect(result.totalTax).toBe(0);
    expect(result.configured).toBe(false);
  });

  it('should apply statutory deductions and compute multi-regime comparative tax liability', async () => {
    // Mock comparative regime call with sample income
    const result = await TaxService.compareTaxRegimes('66b1a2b3c4d5e6f7a8b9c0d1', 'IN', 1200000, 150000);

    expect(result.oldRegime).toBeDefined();
    expect(result.newRegime).toBeDefined();
    expect(result.recommendedRegime).toMatch(/NEW|OLD/);
    expect(result.annualSavings).toBeGreaterThanOrEqual(0);
  });
});
