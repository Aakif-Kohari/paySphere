const TaxBracket = require('../models/taxBracket.model');

class TaxService {
  static async calculateTax(tenantId, region, grossAnnualIncome) {
    const taxConfig = await TaxBracket.findOne({ tenantId, region });
    if (!taxConfig) {
      // Fallback to 0 if no tax configured
      return { totalTax: 0, socialSecurity: 0, effectiveRate: 0 };
    }

    let remainingIncome = grossAnnualIncome;
    let totalTax = 0;

    for (const bracket of taxConfig.brackets) {
      if (remainingIncome <= 0) break;
      
      const taxableInBracket = bracket.maxIncome 
        ? Math.min(remainingIncome, bracket.maxIncome - bracket.minIncome)
        : remainingIncome;
        
      if (taxableInBracket > 0) {
        totalTax += (taxableInBracket * (bracket.ratePercentage / 100)) + bracket.fixedDeduction;
        remainingIncome -= taxableInBracket;
      }
    }

    const socialSecurity = grossAnnualIncome * (taxConfig.socialSecurityRate / 100);
    
    return {
      totalTax,
      socialSecurity,
      effectiveRate: ((totalTax + socialSecurity) / grossAnnualIncome) * 100
    };
  }
}

module.exports = TaxService;
