/**
 * @fileoverview Shift Allowance & On-Call Schemas
 * @description Tracks allowance rules, on-call schedules, and calculated payout line items.
 * Issue: #1473
 */
const mongoose = require('mongoose');

/**
 * AllowanceRule Schema
 * Defines time-window multipliers (e.g., Night Shift, Weekend, Public Holiday).
 */
const allowanceRuleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true }, // e.g., "Night Shift Differential"
    type: { type: String, enum: ['TimeWindow', 'DayOfWeek', 'PublicHoliday', 'Hazard'], required: true },

    // Time Window Configuration (for TimeWindow type)
    startTime: { type: String, default: '00:00' }, // HH:mm
    endTime: { type: String, default: '06:00' },   // HH:mm

    // Day Configuration (for DayOfWeek type)
    applicableDays: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday, 6 = Saturday

    multiplier: { type: Number, required: true, min: 1.0 }, // e.g., 1.25 for 25% premium
    flatRatePerHour: { type: Number, default: 0 }, // Alternative to multiplier

    // Guardrails
    allowDoubleDip: { type: Boolean, default: false }, // Can this stack with other rules?
    priority: { type: Number, default: 1 }, // Higher priority rules override lower ones if no double-dip

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const AllowanceRule = mongoose.model('AllowanceRule', allowanceRuleSchema);

/**
 * OnCallSchedule Schema
 * Tracks employees assigned to on-call status with flat stipends.
 */
const onCallScheduleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Stipend Configuration
    dailyStipend: { type: Number, required: true, min: 0 },
    callOutMultiplier: { type: Number, default: 1.5 }, // Multiplier if actually called in

    status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'], default: 'Scheduled' }
}, { timestamps: true });

const OnCallSchedule = mongoose.model('OnCallSchedule', onCallScheduleSchema);

/**
 * PayoutLineItem Schema
 * Stores the calculated allowances ready for payroll injection.
 */
const payoutLineItemSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    componentName: { type: String, required: true }, // e.g., "Night Shift Differential"
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AllowanceRule' },

    premiumHours: { type: Number, default: 0 },
    amount: { type: Number, required: true },

    status: {
        type: String,
        enum: ['Calculated', 'Approved', 'Injected', 'Rejected'],
        default: 'Calculated',
        index: true
    },

    anomalies: [{ type: String }] // e.g., "Missing punch out", "Overlapping rules"
}, { timestamps: true });

payoutLineItemSchema.index({ employeeId: 1, year: 1, month: 1, componentName: 1 });
const PayoutLineItem = mongoose.model('PayoutLineItem', payoutLineItemSchema);

module.exports = { AllowanceRule, OnCallSchedule, PayoutLineItem };
