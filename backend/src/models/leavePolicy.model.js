/**
 * @fileoverview Leave Policy Schema
 * @description Defines company-wide or department-specific rules for leave accrual.
 * Issue: #646
 */

const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        leaveType: {
            type: String,
            required: true,
            enum: ['earned', 'sick', 'casual', 'compensatory'],
        },
        accrualRate: {
            type: Number,
            required: true,
            min: 0,
            default: 1.5, // e.g., 1.5 days per month
        },
        maxCarryForward: {
            type: Number,
            default: null, // null means unlimited
            min: 0,
        },
        maxAccumulation: {
            type: Number,
            default: null, // Maximum total balance allowed at any time
            min: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        financialYearEndMonth: {
            type: Number, // 1-12 (e.g., 3 for March in India)
            default: 3,
            min: 1,
            max: 12,
        }
    },
    { timestamps: true }
);

// Ensure unique policy names per tenant
leavePolicySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('LeavePolicy', leavePolicySchema);
