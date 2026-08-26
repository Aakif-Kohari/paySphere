'use strict';
const mongoose = require('mongoose');

const payrollReconciliationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true, index: true },
    anomalyType: { type: String, required: true },
    reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    justification: { type: String, required: true },
    status: { type: String, enum: ['active', 'reconciled'], default: 'reconciled' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PayrollReconciliation', payrollReconciliationSchema);