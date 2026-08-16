/**
 * @fileoverview Tax Proof Submission Schema
 * @description Tracks employee tax-saving investment proofs (Form 12BB) for Indian financial years.
 * Supports multiple sections (80C, 80D, HRA, NPS) and verification workflows.
 * Issue: #982
 */
const mongoose = require('mongoose');

const taxProofSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
        financialYear: { type: Number, required: true }, // e.g., 2024 (for FY 2024-25)
        sectionType: {
            type: String,
            required: true,
            enum: ['80C', '80D', '80CCD(1B)', '80E', '80G', 'HRA', 'LTA', 'Home Loan Interest', 'Other'],
        },
        claimedAmount: { type: Number, required: true, min: 0 },
        approvedAmount: { type: Number, default: 0, min: 0 },
        receiptUrls: [{ type: String, required: true }], // Array of S3/local file paths
        status: {
            type: String,
            enum: ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Partially Approved'],
            default: 'Submitted',
            index: true
        },
        remarks: { type: String, default: '' },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Compound index to prevent duplicate submissions for the same section in the same FY
taxProofSchema.index({ tenantId: 1, employeeId: 1, financialYear: 1, sectionType: 1 }, { unique: true });

module.exports = mongoose.model('TaxProof', taxProofSchema);
