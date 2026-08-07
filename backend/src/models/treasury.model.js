const mongoose = require('mongoose');

const treasurySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  baseCurrency: { type: String, default: 'USD' },
  balances: { type: Map, of: Number }
}, { timestamps: true });

module.exports = mongoose.model('Treasury', treasurySchema);
