/**
 * @fileoverview Wage Garnishment & Remittance Schemas
 * @description Tracks court-ordered deductions, statutory caps, and agency remittances.
 * Issue: #1369
 */
const mongoose = require('mongoose');

/**
 * GarnishmentOrder Schema
 * Represents a legal mandate to deduct wages for a specific debt.
 */
const garnishmentOrderSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    type: {
        type: String,
        enum: ['Child Support', 'Tax Levy', 'Student Loan', 'Creditor Debt', 'Other'],
        required: true
    },
    agencyName: { type: String, required: true }, // e.g., "IRS", "State Child Support Agency"
    agencyRemittanceEmail: { type: String, default: '' },
    caseNumber: { type: String, required: true, unique: true },

    // Financial Limits
    totalAmountOwed: { type: Number, required: true, min: 0 },
    amountDeductedToDate: { type: Number, default: 0 },
    monthlyDeductionAmount: { type: Number, default: 0 }, // Fixed amount or calculated max

    // Priority (Lower number = higher priority. 1 = Child Support, 2 = Tax, 3 = Creditor)
    priority: { type: Number, required: true, default: 3 },

    status: {
        type: String,
        enum: ['Active', 'Satisfied', 'Released', 'Paused'],
        default: 'Active',
        index: true
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null } // Null means until satisfied
}, { timestamps: true });

const GarnishmentOrder = mongoose.model('GarnishmentOrder', garnishmentOrderSchema);

/**
 * RemittanceLedger Schema
 * Tracks payments made by the employer to the external agencies.
 */
const remittanceLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'GarnishmentOrder', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    deductionMonth: { type: Number, required: true },
    deductionYear: { type: Number, required: true },
    amountRemitted: { type: Number, required: true },

    remittedAt: { type: Date, default: Date.now },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const RemittanceLedger = mongoose.model('RemittanceLedger', remittanceLedgerSchema);

module.exports = { GarnishmentOrder, RemittanceLedger };
