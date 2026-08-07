const mongoose = require('mongoose');

const benefitRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  astPayload: { type: Object, required: true }, // Serialized JSON AST
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('BenefitRule', benefitRuleSchema);
