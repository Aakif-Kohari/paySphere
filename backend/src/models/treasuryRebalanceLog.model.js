const mongoose = require('mongoose');

const treasuryRebalanceLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    fromCurrency: { type: String, required: true },
    toCurrency: { type: String, required: true },
    amountSwapped: { type: Number, required: true },
    fxRate: { type: Number, required: true },
    status: { type: String, enum: ['Success', 'Failed'], required: true },
    details: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TreasuryRebalanceLog', treasuryRebalanceLogSchema);
