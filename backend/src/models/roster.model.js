/**
 * @fileoverview Rostering & Fatigue Management Schemas
 * @description Tracks shift templates, legal constraints, and generated rosters 
 * with fatigue scoring to ensure labor law compliance.
 * Issue: #1289
 */
const mongoose = require('mongoose');

/**
 * RosterConstraint Schema
 * Defines legal and company-specific limits for shift scheduling.
 */
const rosterConstraintSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    maxConsecutiveDays: { type: Number, default: 6, min: 1, max: 14 },
    minRestHoursBetweenShifts: { type: Number, default: 11, min: 8, max: 24 },
    maxWeeklyHours: { type: Number, default: 48, min: 20, max: 80 },
    maxShiftDurationHours: { type: Number, default: 12, min: 4, max: 16 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const RosterConstraint = mongoose.model('RosterConstraint', rosterConstraintSchema);

/**
 * ShiftTemplate Schema
 * Defines standard shift timings and required skills.
 */
const shiftTemplateSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true }, // e.g., "Morning Shift", "Night Shift"
    startTime: { type: String, required: true }, // "08:00"
    endTime: { type: String, required: true },   // "16:00"
    durationHours: { type: Number, required: true },
    requiredSkills: [{ type: String }],
    colorCode: { type: String, default: '#3b82f6' } // For calendar UI
}, { timestamps: true });

const ShiftTemplate = mongoose.model('ShiftTemplate', shiftTemplateSchema);

/**
 * GeneratedRoster Schema
 * The actual scheduled shift for an employee on a specific date.
 */
const generatedRosterSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    shiftTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftTemplate', required: true },
    date: { type: Date, required: true, index: true },

    // Fatigue & Compliance Metrics
    fatigueScore: { type: Number, default: 0, min: 0, max: 100 }, // 0 = Rested, 100 = Extreme Burnout Risk
    isCompliant: { type: Boolean, default: true },
    complianceWarnings: [{ type: String }], // e.g., ['Violates 11-hour rest gap']

    status: {
        type: String,
        enum: ['Draft', 'Published', 'Swapped', 'Cancelled'],
        default: 'Draft',
        index: true
    }
}, { timestamps: true });

generatedRosterSchema.index({ tenantId: 1, date: 1, employeeId: 1 }, { unique: true });
const GeneratedRoster = mongoose.model('GeneratedRoster', generatedRosterSchema);

module.exports = { RosterConstraint, ShiftTemplate, GeneratedRoster };
