/**
 * @fileoverview Employee Deputation Schema
 * @description Tracks temporary or permanent transfers of employees between corporate entities
 * without breaking their core Employee record or historical data.
 * Issue: #999
 */
const mongoose = require('mongoose');

const deputationSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    fromTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    toTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null }, // Null implies permanent transfer

    type: { type: String, enum: ['Temporary', 'Permanent'], required: true },
    status: {
        type: String,
        enum: ['Pending Approval', 'Active', 'Completed', 'Cancelled'],
        default: 'Pending Approval',
        index: true
    },

    payrollResponsibility: {
        type: String,
        enum: ['Home Entity', 'Host Entity'],
        default: 'Host Entity' // Who pays the salary during deputation
    },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    reason: { type: String, default: '' },
}, { timestamps: true });

deputationSchema.index({ fromTenantId: 1, toTenantId: 1 });
module.exports = mongoose.model('Deputation', deputationSchema);
