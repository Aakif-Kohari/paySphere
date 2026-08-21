const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const treasurySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    baseCurrency: { type: String, default: 'USD' },
    balances: { type: Map, of: Number, default: {} },
    minReserves: {
      type: Map,
      of: Number,
      default: { 'USD': 100000, 'EUR': 50000, 'GBP': 30000 }
    },
  },
  { timestamps: true },
);

treasurySchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Treasury', treasurySchema);
