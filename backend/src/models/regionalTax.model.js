const mongoose = require('mongoose');

const taxSyncLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    syncType: { type: String, enum: ['OnDemand', 'Scheduled'], required: true },
    status: { type: String, enum: ['Success', 'Failed'], required: true },
    details: { type: String, default: '' },
    bracketsUpdated: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = {
  TaxSyncLog: mongoose.model('TaxSyncLog', taxSyncLogSchema)
};
