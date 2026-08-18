/**
 * @fileoverview TOIL (Time-Off in Lieu) & Compensatory Off Schemas
 * @description Manages accrual policies, ledger balances, and expiration tracking 
 * for employees earning comp-offs via weekend or holiday work.
 * Issue: #1165
 */
const mongoose = require('mongoose');

/**
 * ToilPolicy Schema
 * Defines company-wide rules for TOIL accrual, caps, and expiration.
 */
const toilPolicySchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    weekendMultiplier: { type: Number, default: 1.0, min: 0 }, // e.g., 1 day worked = 1 TOIL day
    holidayMultiplier: { type: Number, default: 1.5, min: 0 }, // e.g., 1 public holiday = 1.5 TOIL days
    maxAccumulationDays: { type: Number, default: 15, min: 0 }, // Max TOIL days an employee can hold
    expirationDays: { type: Number, default: 90, min: 1 }, // Days until an accrued TOIL expires
    allowEncashment: { type: Boolean, default: false }, // Can employees cash out TOIL instead of taking leave?
    isActive: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const ToilPolicy = mongoose.model('ToilPolicy', toilPolicySchema);

/**
 * ToilLedger Schema
 * Immutable transaction log tracking every accrual, usage, and expiration.
 */
const toilLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    transactionType: {
        type: String,
        enum: ['Accrual', 'Usage', 'Expiration', 'Encashment', 'Adjustment'],
        required: true
    },
    days: { type: Number, required: true }, // Positive for accruals, negative for usage/expirations
    balanceAfter: { type: Number, required: true },
    expiresAt: { type: Date, default: null, index: true }, // Only set for Accrual transactions
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Links to Attendance or Request
    description: { type: String, default: '' },
}, { timestamps: true });

toilLedgerSchema.index({ tenantId: 1, employeeId: 1, createdAt: -1 });
const ToilLedger = mongoose.model('ToilLedger', toilLedgerSchema);

/**
 * ToilRequest Schema
 * Tracks employee requests to utilize or encash their TOIL balance.
 */
const toilRequestSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    requestType: { type: String, enum: ['TimeOff', 'Encashment'], required: true },
    daysRequested: { type: Number, required: true, min: 0.5 },
    startDate: { type: Date, required: function () { return this.requestType === 'TimeOff'; } },
    endDate: { type: Date, required: function () { return this.requestType === 'TimeOff'; } },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending',
        index: true
    },
    remarks: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

const ToilRequest = mongoose.model('ToilRequest', toilRequestSchema);

module.exports = { ToilPolicy, ToilLedger, ToilRequest };
