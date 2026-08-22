/**
 * @fileoverview Corporate Relocation & Tax Gross-Up Schemas
 * @description Tracks moving budgets, expense receipts, and tax gross-up liabilities.
 * Issue: #1368
 */
const mongoose = require('mongoose');

const relocationRequestSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    originCity: { type: String, required: true },
    destinationCity: { type: String, required: true },
    relocationDate: { type: Date, required: true },

    approvedBudget: { type: Number, default: 0 },
    marginalTaxRate: { type: Number, default: 0.30 }, // e.g., 30% tax bracket

    status: {
        type: String,
        enum: ['Requested', 'Approved', 'In Progress', 'Completed', 'Rejected'],
        default: 'Requested',
        index: true
    },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const RelocationRequest = mongoose.model('RelocationRequest', relocationRequestSchema);

const relocationExpenseSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'RelocationRequest', required: true, index: true },

    category: {
        type: String,
        enum: ['Moving Services', 'Temporary Housing', 'Travel', 'Brokerage', 'Miscellaneous'],
        required: true
    },
    amount: { type: Number, required: true, min: 0 },
    receiptUrl: { type: String, required: true },
    description: { type: String, default: '' },

    // Taxability flags (some relocation expenses are tax-exempt depending on jurisdiction)
    isTaxable: { type: Boolean, default: true },

    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    }
}, { timestamps: true });

const RelocationExpense = mongoose.model('RelocationExpense', relocationExpenseSchema);

const taxGrossUpSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'RelocationRequest', required: true, unique: true },

    totalTaxableExpenses: { type: Number, required: true },
    grossUpAmount: { type: Number, required: true }, // The additional gross pay needed
    taxRateApplied: { type: Number, required: true },

    isInjectedToPayroll: { type: Boolean, default: false },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null }
}, { timestamps: true });

const TaxGrossUp = mongoose.model('TaxGrossUp', taxGrossUpSchema);

module.exports = { RelocationRequest, RelocationExpense, TaxGrossUp };
