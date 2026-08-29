'use strict';
const mongoose = require('mongoose');

const documentSealSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    documentType: { type: String, enum: ['payslip', 'form16', 'contract'], required: true },
    documentHash: { type: String, required: true, unique: true, index: true },
    signedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    signature: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DocumentSeal', documentSealSchema);