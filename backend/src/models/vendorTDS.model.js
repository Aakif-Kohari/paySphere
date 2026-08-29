/**
 * @fileoverview Vendor TDS & Compliance Schemas
 * @description Tracks vendor tax profiles (PAN/TAN), cumulative thresholds, 
 * and quarterly TDS deduction ledgers for Form 26Q generation.
 * Issue: #1291
 */
const mongoose = require('mongoose');

/**
 * VendorTDSProfile Schema
 * Stores tax identification and section-specific configuration for B2B vendors.
 */
const vendorTDSProfileSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    vendorName: { type: String, required: true, trim: true },
    pan: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        match: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/ // Standard PAN validation
    },

    // TDS Configuration
    sectionType: {
        type: String,
        enum: ['194C', '194J', '194I', '194Q', 'Other'],
        required: true
    },
    standardRate: { type: Number, default: 0 }, // e.g., 1%, 2%, 10%

    // Lower Deduction Certificate (LDC)
    hasLDC: { type: Boolean, default: false },
    ldcRate: { type: Number, default: 0, min: 0, max: 100 },
    ldcCertificateNo: { type: String, default: '' },
    ldcValidUntil: { type: Date, default: null },

    // Compliance Flags
    isPanInvalid: { type: Boolean, default: false }, // Triggers 20% penalty u/s 206AA
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

vendorTDSProfileSchema.index({ tenantId: 1, pan: 1 }, { unique: true });
const VendorTDSProfile = mongoose.model('VendorTDSProfile', vendorTDSProfileSchema);

/**
 * TDSLedger Schema
 * Immutable log of every payment made to a vendor and the TDS deducted.
 */
const tdsLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorTDSProfile', required: true, index: true },

    invoiceNo: { type: String, required: true },
    invoiceDate: { type: Date, required: true },

    // Financials
    grossAmount: { type: Number, required: true },
    tdsRateApplied: { type: Number, required: true }, // The actual % used
    tdsAmount: { type: Number, required: true },
    netPayable: { type: Number, required: true },

    // Metadata
    section: { type: String, required: true }, // 194C, 194J, etc.
    financialYear: { type: String, required: true }, // e.g., "2026-27"
    quarter: { type: String, required: true }, // Q1, Q2, Q3, Q4

    status: {
        type: String,
        enum: ['Deducted', 'Deposited', 'Filed in 26Q'],
        default: 'Deducted'
    }
}, { timestamps: true });

tdsLedgerSchema.index({ tenantId: 1, financialYear: 1, quarter: 1 });
const TDSLedger = mongoose.model('TDSLedger', tdsLedgerSchema);

/**
 * Form26QDraft Schema
 * Stores the generated text file content for government upload.
 */
const form26QDraftSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    financialYear: { type: String, required: true },
    quarter: { type: String, required: true },

    fileContent: { type: String, required: true }, // The pipe-delimited text
    fileName: { type: String, required: true },

    stats: {
        totalVendors: Number,
        totalTransactions: Number,
        totalTDS: Number
    },

    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Form26QDraft = mongoose.model('Form26QDraft', form26QDraftSchema);

module.exports = { VendorTDSProfile, TDSLedger, Form26QDraft };
