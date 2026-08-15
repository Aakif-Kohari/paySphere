/**
 * @fileoverview Shift Roster & Swap Request Schemas
 * @description Manages shift templates, employee scheduling, and swap workflows.
 * Issue: #956
 */
const mongoose = require('mongoose');

const shiftTemplateSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g., 'Morning Shift'
    startTime: { type: String, required: true }, // HH:mm format (e.g., '06:00')
    endTime: { type: String, required: true },   // HH:mm format (e.g., '14:00')
    colorCode: { type: String, default: '#3b82f6' }, // Hex color for calendar UI
    breakDurationMins: { type: Number, default: 60 },
}, { timestamps: true });

shiftTemplateSchema.index({ tenantId: 1, name: 1 }, { unique: true });
const ShiftTemplate = mongoose.model('ShiftTemplate', shiftTemplateSchema);

const shiftRosterSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    shiftTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftTemplate', required: true },
    date: { type: Date, required: true }, // The calendar date of the shift
    status: {
        type: String,
        enum: ['Scheduled', 'Completed', 'Missed', 'Swapped'],
        default: 'Scheduled'
    },
}, { timestamps: true });

// Prevent double-booking the same employee on the same day at the DB level
shiftRosterSchema.index({ tenantId: 1, employeeId: 1, date: 1 }, { unique: true });
const ShiftRoster = mongoose.model('ShiftRoster', shiftRosterSchema);

const shiftSwapRequestSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    originalRosterId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftRoster', required: true },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    replacementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    targetRosterId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftRoster', default: null }, // The shift the replacement is giving up
    status: {
        type: String,
        enum: ['Pending Peer', 'Pending Manager', 'Approved', 'Rejected'],
        default: 'Pending Peer'
    },
    managerNotes: { type: String, default: '' },
}, { timestamps: true });

const ShiftSwapRequest = mongoose.model('ShiftSwapRequest', shiftSwapRequestSchema);

module.exports = { ShiftTemplate, ShiftRoster, ShiftSwapRequest };
