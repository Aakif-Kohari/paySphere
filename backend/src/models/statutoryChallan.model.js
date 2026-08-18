/**
 * @fileoverview Statutory Challan & Compliance Vault Schemas
 * @description Tracks generated EPFO/ESIC ECR files, payment receipts, and 
 * maintains an audit-ready compliance history for Indian statutory filings.
 * Issue: #1169
 */
const mongoose = require('mongoose');

const statutoryChallanSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    type: { type: String, enum: ['EPFO', 'ESIC', 'PT', 'LWF'], required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    status: {
        type: String,
        enum: ['Validating', 'Generated', 'Uploaded to Portal', 'Paid', 'Failed Validation'],
        default: 'Validating',
        index: true
    },

    // File Storage (S3/Local URLs)
    ecrFileUrl: { type: String, default: '' },
    paymentReceiptUrl: { type: String, default: '' },

    // Financial Totals
    totalEmployees: { type: Number, default: 0 },
    totalGrossWages: { type: Number, default: 0 },
    totalEmployerContribution: { type: Number, default: 0 },
    totalEmployeeContribution: { type: Number, default: 0 },
    totalChallanAmount: { type: Number, default: 0 },

    // Validation Errors
    validationErrors: [{
        employeeId: mongoose.Schema.Types.ObjectId,
        employeeName: String,
        errorType: String, // e.g., 'Missing UAN', 'Wage Ceiling Breach'
        message: String
    }],

    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paidAt: { type: Date, default: null }
}, { timestamps: true });

statutoryChallanSchema.index({ tenantId: 1, type: 1, month: 1, year: 1 }, { unique: true });
const StatutoryChallan = mongoose.model('StatutoryChallan', statutoryChallanSchema);

module.exports = { StatutoryChallan };
