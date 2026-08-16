/**
 * @fileoverview Contract & Offer Letter Schemas
 * @description Manages dynamic HTML templates and the lifecycle of issued contracts.
 * Issue: #984
 */
const mongoose = require('mongoose');
const crypto = require('crypto');

const contractTemplateSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g., "Standard Developer Offer"
    subject: { type: String, required: true },
    htmlContent: { type: String, required: true }, // HTML with {{variables}}
    variables: [{ type: String }], // e.g., ['candidateName', 'basicSalary', 'joiningDate']
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const ContractTemplate = mongoose.model('ContractTemplate', contractTemplateSchema);

const issuedContractSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContractTemplate', required: true },
    candidateName: { type: String, required: true },
    candidateEmail: { type: String, required: true },
    populatedHtml: { type: String, required: true }, // The final HTML with variables replaced
    pdfUrl: { type: String, default: '' }, // Path to generated PDF

    // Magic Link Security
    magicToken: { type: String, required: true, unique: true, index: true },
    magicTokenExpiresAt: { type: Date, required: true },

    status: {
        type: String,
        enum: ['Draft', 'Sent', 'Viewed', 'Accepted', 'Declined', 'Expired'],
        default: 'Draft',
        index: true
    },

    acceptedAt: { type: Date, default: null },
    ipAddressAccepted: { type: String, default: '' },
}, { timestamps: true });

// Helper to generate secure magic tokens
issuedContractSchema.statics.generateMagicToken = function () {
    return crypto.randomBytes(32).toString('hex');
};

const IssuedContract = mongoose.model('IssuedContract', issuedContractSchema);

module.exports = { ContractTemplate, IssuedContract };
