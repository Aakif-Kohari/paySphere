/**
 * @fileoverview Payroll Reversal & Clawback Schemas
 * @description Tracks formal payroll reversals, gross/tax deltas, and recovery schedules
 * for mid-month clawbacks without mutating the immutable payroll ledger.
 * Issue: #1166
 */
const mongoose = require('mongoose');

const clawbackScheduleSchema = new mongoose.Schema({
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    deductionAmount: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ['Pending', 'Deducted', 'Skipped'],
        default: 'Pending'
    },
    appliedToPayrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null }
}, { _id: true });

const payrollReversalSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    originalPayrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },

    // Financial Deltas
    grossOverpaid: { type: Number, required: true, min: 0 },
    taxOverpaid: { type: Number, required: true, min: 0 },
    statutoryOverpaid: { type: Number, required: true, min: 0 }, // PF/ESI
    netOverpaid: { type: Number, required: true, min: 0 }, // The actual cash to be clawed back

    reason: { type: String, required: true, maxlength: 1000 },

    status: {
        type: String,
        enum: ['Draft', 'Pending Approval', 'Approved', 'Recovery Active', 'Fully Recovered', 'Cancelled'],
        default: 'Draft',
        index: true
    },

    // Recovery Plan
    recoveryMonths: { type: Number, default: 1, min: 1, max: 12 },
    clawbackSchedule: [clawbackScheduleSchema],

    // Accounting
    journalEntries: [{
        accountName: String,
        nature: { type: String, enum: ['Debit', 'Credit'] },
        amount: Number
    }],

    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null }
}, { timestamps: true });

payrollReversalSchema.index({ tenantId: 1, status: 1 });
const PayrollReversal = mongoose.model('PayrollReversal', payrollReversalSchema);

module.exports = { PayrollReversal };
