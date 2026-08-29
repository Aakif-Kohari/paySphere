/**
 * @fileoverview Client, Invoice, and Forex Ledger Schemas
 * @description Tracks multi-currency invoicing, exchange rates, and realized/unrealized forex gains/losses.
 * Issue: #960
 */
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true },
    defaultCurrency: { type: String, required: true, enum: ['USD', 'EUR', 'GBP', 'INR', 'AED'] },
    billingAddress: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
}, { timestamps: true });

const Client = mongoose.model('Client', clientSchema);

const clientInvoiceSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true, unique: true },
    invoiceDate: { type: Date, required: true },
    foreignAmount: { type: Number, required: true, min: 0 },
    foreignCurrency: { type: String, required: true },
    exchangeRateAtInvoice: { type: Number, required: true, min: 0 }, // e.g., 1 USD = 83.50 INR
    inrEquivalent: { type: Number, required: true, min: 0 }, // foreignAmount * exchangeRate
    amountReceivedINR: { type: Number, default: 0 }, // Actual INR credited to bank
    forexGainLoss: { type: Number, default: 0 }, // Realized gain/loss
    status: { type: String, enum: ['Draft', 'Sent', 'Partially Paid', 'Paid'], default: 'Draft' },
}, { timestamps: true });

const ClientInvoice = mongoose.model('ClientInvoice', clientInvoiceSchema);

const forexLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientInvoice', required: true, index: true },
    transactionDate: { type: Date, required: true, default: Date.now },
    inrReceived: { type: Number, required: true },
    bankCharges: { type: Number, default: 0 },
    realizedGainLoss: { type: Number, required: true }, // Positive = Gain, Negative = Loss
    exchangeRateAtPayment: { type: Number, required: true },
}, { timestamps: true });

const ForexLedger = mongoose.model('ForexLedger', forexLedgerSchema);

module.exports = { Client, ClientInvoice, ForexLedger };
