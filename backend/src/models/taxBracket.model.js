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
