/**
 * @fileoverview Leave Balance Schema
 * @description Tracks the current and historical leave balances for each employee.
 * Issue: #646
 */

const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
            index: true,
        },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        policyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LeavePolicy',
            required: true,
        },
        leaveType: {
            type: String,
            required: true,
            enum: ['earned', 'sick', 'casual', 'compensatory'],
        },
        currentBalance: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        usedThisYear: {
            type: Number,
            default: 0,
            min: 0,
        },
        carriedForwardFromLastYear: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastAccrualDate: {
            type: Date,
            default: null,
        },
        year: {
            type: Number,
            required: true,
        }
    },
    { timestamps: true }
);

// Unique constraint: One balance record per employee, per policy, per year
leaveBalanceSchema.index(
    { tenantId: 1, employeeId: 1, policyId: 1, year: 1 },
    { unique: true }
);

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
