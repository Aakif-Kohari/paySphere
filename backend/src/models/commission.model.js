/**
 * @fileoverview Sales Commission & Draw Ledger Schemas
 * @description Tracks commission plans, quota attainment, accelerators, and draw recoveries.
 * Issue: #1472
 */
const mongoose = require('mongoose');

/**
 * CommissionPlan Schema
 * Defines quota targets, base commission rates, and accelerator tiers.
 */
const commissionPlanSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true }, // e.g., "Q3 Enterprise Sales Plan"
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },

    quotaAmount: { type: Number, required: true, min: 0 },
    baseCommissionRate: { type: Number, required: true, min: 0, max: 1 }, // e.g., 0.10 for 10%

    // Accelerator Tiers (e.g., >100% attainment = 1.5x rate)
    accelerators: [{
        attainmentThreshold: { type: Number, required: true }, // e.g., 1.0 for 100%
        multiplier: { type: Number, required: true } // e.g., 1.5
    }],

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const CommissionPlan = mongoose.model('CommissionPlan', commissionPlanSchema);

/**
 * QuotaAttainment Schema
 * Tracks monthly/quarterly revenue booked vs quota for a specific employee.
 */
const quotaAttainmentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommissionPlan', required: true },

    periodMonth: { type: Number, required: true, min: 1, max: 12 },
    periodYear: { type: Number, required: true },

    revenueBooked: { type: Number, default: 0, min: 0 },
    quotaTarget: { type: Number, required: true },
    attainmentPercentage: { type: Number, default: 0 }, // e.g., 1.15 for 115%

    calculatedCommission: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['Calculated', 'Approved', 'Paid'],
        default: 'Calculated'
    }
}, { timestamps: true });

quotaAttainmentSchema.index({ employeeId: 1, periodYear: 1, periodMonth: 1 }, { unique: true });
const QuotaAttainment = mongoose.model('QuotaAttainment', quotaAttainmentSchema);

/**
 * DrawLedger Schema
 * Tracks recoverable draws (advances against future commissions).
 */
const drawLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    transactionType: {
        type: String,
        enum: ['Draw Advance', 'Commission Offset', 'Clawback'],
        required: true
    },
    amount: { type: Number, required: true }, // Positive for advances/clawbacks, negative for offsets
    balanceAfter: { type: Number, required: true },

    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Links to Attainment or Clawback
    description: { type: String, default: '' }
}, { timestamps: true });

const DrawLedger = mongoose.model('DrawLedger', drawLedgerSchema);

/**
 * Clawback Schema
 * Tracks commission clawbacks due to cancelled or refunded deals.
 */
const clawbackSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    originalAttainmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuotaAttainment', required: true },

    dealName: { type: String, required: true },
    clawbackAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, enum: ['Deal Cancelled', 'Refunded', 'Churned'], required: true },

    status: {
        type: String,
        enum: ['Pending Recovery', 'Recovered via Draw', 'Recovered via Payroll'],
        default: 'Pending Recovery'
    }
}, { timestamps: true });

const Clawback = mongoose.model('Clawback', clawbackSchema);

module.exports = { CommissionPlan, QuotaAttainment, DrawLedger, Clawback };
