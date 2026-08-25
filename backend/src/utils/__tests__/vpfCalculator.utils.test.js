const {
  calculateVpfDeduction,
  evaluateVpfTaxExemption,
  generateVpfEcrLineItem,
  SECTION_80C_CEILING,
  TAX_FREE_PF_CONTRIBUTION_THRESHOLD,
} = require('../vpfCalculator.utils');

describe('vpfCalculator.utils - Voluntary Provident Fund Engine', () => {
  describe('calculateVpfDeduction', () => {
    it('calculates statutory 12% EPF and percentage VPF correctly', () => {
      const basic = 50000;
      const da = 10000; // Total wages = 60000
      const result = calculateVpfDeduction(basic, da, 'PERCENTAGE', 10);

      expect(result.wages).toBe(60000);
      expect(result.statutoryEpf).toBe(7200); // 12% of 60000
      expect(result.monthlyVpf).toBe(6000); // 10% of 60000
      expect(result.totalPfDeduction).toBe(13200);
      expect(result.maxVpfPermissible).toBe(52800); // 88% of 60000
    });

    it('caps VPF at 88% of wages when 100% Basic pay is elected', () => {
      const basic = 40000;
      const da = 0; // Total wages = 40000
      const result = calculateVpfDeduction(basic, da, 'PERCENTAGE', 100);

      expect(result.statutoryEpf).toBe(4800); // 12% of 40000
      expect(result.maxVpfPermissible).toBe(35200); // 88% of 40000
      expect(result.monthlyVpf).toBe(35200);
      expect(result.totalPfDeduction).toBe(40000); // 100% of wages
    });

    it('handles fixed amount VPF election within permissible cap', () => {
      const basic = 30000;
      const da = 0;
      const result = calculateVpfDeduction(basic, da, 'FIXED_AMOUNT', 5000);

      expect(result.statutoryEpf).toBe(3600);
      expect(result.monthlyVpf).toBe(5000);
      expect(result.totalPfDeduction).toBe(8600);
    });

    it('caps fixed amount VPF if it exceeds wages minus EPF', () => {
      const basic = 20000;
      const da = 0;
      const result = calculateVpfDeduction(basic, da, 'FIXED_AMOUNT', 25000);

      expect(result.statutoryEpf).toBe(2400);
      expect(result.maxVpfPermissible).toBe(17600);
      expect(result.monthlyVpf).toBe(17600);
      expect(result.totalPfDeduction).toBe(20000);
    });
  });

  describe('evaluateVpfTaxExemption', () => {
    it('computes 80C deduction within ₹1.5L limit', () => {
      const result = evaluateVpfTaxExemption(60000, 40000, 40000, 20000); // Total PF = 1.4L, Total 80C = 1.6L

      expect(result.totalAnnualPf).toBe(140000);
      expect(result.section80CClaimable).toBe(SECTION_80C_CEILING); // 150000
      expect(result.isExceedingInterestThreshold).toBe(false);
      expect(result.taxableExcessContribution).toBe(0);
    });

    it('flags taxable interest when total annual PF exceeds ₹2.5L', () => {
      const result = evaluateVpfTaxExemption(120000, 100000, 80000, 0); // Total PF = 300000

      expect(result.totalAnnualPf).toBe(300000);
      expect(result.isExceedingInterestThreshold).toBe(true);
      expect(result.taxableExcessContribution).toBe(50000); // 300000 - 250000
    });
  });

  describe('generateVpfEcrLineItem', () => {
    it('formats ECR remittance line item', () => {
      const item = generateVpfEcrLineItem('EMP-01', '101234567890', 'Aarav Sharma', 50000, 6000, 5000, 8, 2026);

      expect(item.employeeId).toBe('EMP-01');
      expect(item.uan).toBe('101234567890');
      expect(item.epfWages).toBe(50000);
      expect(item.statutoryEpfEmployeeShare).toBe(6000);
      expect(item.vpfEmployeeContribution).toBe(5000);
      expect(item.totalEmployeePfRemitted).toBe(11000);
    });
  });
});
