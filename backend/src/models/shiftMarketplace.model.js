/**
 * @fileoverview Shift Marketplace Schemas
 * @description Manages open shifts posted by managers and bids placed by employees.
 * Includes priority scoring and waitlist queues for automated assignment.
 * Issue: #1081
 */
const mongoose = require('mongoose');

const openShiftSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    shiftTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftTemplate', required: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    requiredRole: { type: String, default: '' },
    requiredDepartment: { type: String, default: '' },
    premiumMultiplier: { type: Number, default: 1.0, min: 1.0 }, // e.g., 1.5 for time-and-a-half
    reason: { type: String, default: 'Uncovered Shift' },
    status: {
        type: String,
        enum: ['Open', 'Assigned', 'Expired', 'Cancelled'],
        default: 'Open',
        index: true
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true } // Auto-close if not filled
}, { timestamps: true });

openShiftSchema.index({ tenantId: 1, date: 1, status: 1 });
const OpenShift = mongoose.model('OpenShift', openShiftSchema);

const shiftBidSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    openShiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'OpenShift', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    status: {
        type: String,
        enum: ['Pending', 'Accepted', 'Rejected', 'Waitlisted', 'Withdrawn'],
        default: 'Pending',
        index: true
    },
    priorityScore: { type: Number, default: 0 }, // Higher = better match (tenure, dept match)
    bidMessage: { type: String, default: '' },
    conflictFlags: [{ type: String }] // e.g., ['Rest Period Violation']
}, { timestamps: true });

shiftBidSchema.index({ openShiftId: 1, employeeId: 1 }, { unique: true });
const ShiftBid = mongoose.model('ShiftBid', shiftBidSchema);

module.exports = { OpenShift, ShiftBid };
