const mongoose = require('mongoose');

const cryptoPayoutRecipientSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  address: { type: String, required: true },
  amount: { type: Number, required: true }
}, { _id: false });

const cryptoPayoutBatchSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  walletId: { type: String, required: true },
  tokenSymbol: { type: String, required: true, default: 'USDC-SPL' },
  tokenAddress: { type: String, required: true },
  txHash: { type: String, index: true },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Failed'], default: 'Pending', index: true },
  recipients: [cryptoPayoutRecipientSchema],
  blockNumber: { type: Number },
  confirmations: { type: Number, default: 0 },
  confirmedAt: { type: Date }
}, { timestamps: true });

module.exports = {
  CryptoPayoutBatch: mongoose.model('CryptoPayoutBatch', cryptoPayoutBatchSchema)
};
