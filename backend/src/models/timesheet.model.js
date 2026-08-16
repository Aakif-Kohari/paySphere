/**
 * @fileoverview Timesheet & Milestone Schemas
 * @description Tracks hourly logs for gig-workers and fixed-bid project milestones.
 * Integrates with the Vendor TDS (194C) engine for automated invoice generation.
 * Issue: #1000
 */
const mongoose = require('mongoose');

/**
 * Timesheet Entry Schema
 * Records individual start/stop blocks or manual time entries for contractors.
 */
const timesheetEntrySchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true }, // Links to Vendor schema
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },

    // Time Tracking
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0, min: 0 }, // Calculated on stop

    // Metadata & Fraud Prevention
    entryType: { type: String, enum: ['Timer', 'Manual'], default: 'Timer' },
    deviceIp: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    isFlagged: { type: Boolean, default: false }, // Flagged for idle/fraud detection
    flagReason: { type: String, default: '' },

    // Billing & Approval
    hourlyRate: { type: Number, required: true, min: 0 }, // Locked at the time of entry
    billableAmount: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['In Progress', 'Pending Approval', 'Approved', 'Rejected', 'Invoiced'],
        default: 'In Progress',
        index: true
    },

    description: { type: String, default: '', maxlength: 500 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
}, { timestamps: true });

timesheetEntrySchema.index({ tenantId: 1, contractorId: 1, startTime: -1 });
const TimesheetEntry = mongoose.model('TimesheetEntry', timesheetEntrySchema);

/**
 * Project Milestone Schema
 * Tracks fixed-bid deliverables that trigger payouts upon completion.
 */
const projectMilestoneSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    agreedAmount: { type: Number, required: true, min: 0 },

    status: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Submitted for Review', 'Approved', 'Paid'],
        default: 'Not Started',
        index: true
    },

    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: '' },
}, { timestamps: true });

const ProjectMilestone = mongoose.model('ProjectMilestone', projectMilestoneSchema);

module.exports = { TimesheetEntry, ProjectMilestone };
