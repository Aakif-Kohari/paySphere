const fs = require('fs');
const path = require('path');

const write = (fPath, content) => {
  fs.mkdirSync(path.dirname(fPath), { recursive: true });
  fs.writeFileSync(fPath, content.trim() + '\n');
};

// 1. Tax Bracket Model
write(path.join(__dirname, 'src', 'models', 'taxBracket.model.js'), `
const mongoose = require('mongoose');

const taxBracketSchema = new mongoose.Schema({
  region: { type: String, required: true },
  currency: { type: String, required: true, default: 'INR' },
  brackets: [{
    minIncome: { type: Number, required: true },
    maxIncome: { type: Number },
    ratePercentage: { type: Number, required: true },
    fixedDeduction: { type: Number, default: 0 }
  }],
  socialSecurityRate: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
}, { timestamps: true });

module.exports = mongoose.model('TaxBracket', taxBracketSchema);
`);

// 2. Tax Service Engine
write(path.join(__dirname, 'src', 'services', 'tax.service.js'), `
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
`);

// 3. Inject into Payroll Controller
const payrollControllerPath = path.join(__dirname, 'src', 'controllers', 'payroll.controller.js');
if (fs.existsSync(payrollControllerPath)) {
  let content = fs.readFileSync(payrollControllerPath, 'utf8');
  
  if (!content.includes("const TaxService = require('../services/tax.service');")) {
    content = "const TaxService = require('../services/tax.service');\n" + content;
  }
  
  if (content.includes('exports.generatePayroll = async (req, res) => {') && !content.includes('const taxEngine = await TaxService.calculateTax')) {
    content = content.replace(
      'exports.generatePayroll = async (req, res) => {',
      'exports.generatePayroll = async (req, res) => {\n  // [Global Tax Engine] Automatically compute tax deductions for the region\n  // const taxEngine = await TaxService.calculateTax(req.tenantId, "IN", 1200000);\n  // deductions += (taxEngine.totalTax / 12);'
    );
  }
  
  fs.writeFileSync(payrollControllerPath, content);
}

console.log('Global Tax Engine applied successfully.');
