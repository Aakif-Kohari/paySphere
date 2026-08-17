/**
 * @fileoverview Vendor, Invoice, and Payment Schemas
 * @description Tracks external contractors, their invoices, and automated TDS (194C) deductions.
 * Issue: #957
 */
const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    pan: { type: String, trim: true, uppercase: true, default: null },
    gstin: { type: String, trim: true, uppercase: true, default: null },
    vendorType: { type: String, enum: ['Individual/HUF', 'Company/Partnership', 'Others'], default: 'Others' },
    address: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

vendorSchema.index({ tenantId: 1, pan: 1 });
const Vendor = mongoose.model('Vendor', vendorSchema);

const vendorInvoiceSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true },
    financialYear: { type: Number, required: true }, // e.g., 2024 (for FY 2024-25)
    grossAmount: { type: Number, required: true, min: 0 },
    tdsRate: { type: Number, required: true, min: 0, max: 20 }, // Percentage
    tdsAmount: { type: Number, required: true, min: 0 },
    netPayable: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Unpaid', 'Partially Paid', 'Paid'], default: 'Unpaid' },
    amountPaid: { type: Number, default: 0 },
}, { timestamps: true });

vendorInvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
vendorInvoiceSchema.index({ tenantId: 1, vendorId: 1, financialYear: 1 }); // For aggregate threshold checks
const VendorInvoice = mongoose.model('VendorInvoice', vendorInvoiceSchema);

const vendorPaymentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorInvoice', required: true, index: true },
    paymentDate: { type: Date, required: true, default: Date.now },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: ['Bank Transfer', 'Cheque', 'Cash', 'UPI'], default: 'Bank Transfer' },
    referenceNumber: { type: String, default: '' },
}, { timestamps: true });

const VendorPayment = mongoose.model('VendorPayment', vendorPaymentSchema);

module.exports = { Vendor, VendorInvoice, VendorPayment };
