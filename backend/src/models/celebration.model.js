/**
 * @fileoverview Celebration Event Schema
 * @description Tracks generated birthday and work anniversary events to prevent 
 * duplicate notifications and maintain a history of automated celebrations.
 * Issue: #1286
 */
const mongoose = require('mongoose');

const celebrationSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },

    // Type of celebration
    type: {
        type: String,
        enum: ['Birthday', 'WorkAnniversary'],
        required: true
    },

    // Milestone details
    milestoneYears: {
        type: Number,
        default: null // Used for Work Anniversaries (e.g., 1, 5, 10 years)
    },
    eventDate: {
        type: Date,
        required: true,
        index: true
    },

    // Notification tracking
    isNotified: {
        type: Boolean,
        default: false
    },
    notifiedAt: {
        type: Date,
        default: null
    },

    // Engagement metrics
    reactionCount: {
        type: Number,
        default: 0
    },
    message: {
        type: String,
        default: ''
    }
}, { timestamps: true });

// Prevent duplicate events for the same employee, type, and date
celebrationSchema.index({ tenantId: 1, employeeId: 1, type: 1, eventDate: 1 }, { unique: true });

const Celebration = mongoose.model('Celebration', celebrationSchema);

module.exports = { Celebration };
