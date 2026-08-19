/**
 * @fileoverview Internal Job & Application Schemas
 * @description Manages internal vacancies, applicant tracking, and seamless department transfers.
 * Issue: #1167
 */
const mongoose = require('mongoose');

const internalJobSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    department: { type: String, required: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    description: { type: String, required: true },
    requiredSkills: [{ type: String }],
    status: {
        type: String,
        enum: ['Open', 'Interviewing', 'Closed', 'Filled'],
        default: 'Open',
        index: true
    },
    resetProbation: { type: Boolean, default: false }, // Toggle for new 30-60-90 day onboarding
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    closedAt: { type: Date, default: null }
}, { timestamps: true });

const InternalJob = mongoose.model('InternalJob', internalJobSchema);

const internalApplicationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternalJob', required: true, index: true },
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    status: {
        type: String,
        enum: ['Applied', 'Screening', 'Interviewing', 'Offered', 'Hired', 'Rejected', 'Withdrawn'],
        default: 'Applied',
        index: true
    },

    coverLetter: { type: String, default: '' },
    hiringManagerNotes: { type: String, default: '' },
    interviewDate: { type: Date, default: null },

    transferredAt: { type: Date, default: null },
}, { timestamps: true });

internalApplicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
const InternalApplication = mongoose.model('InternalApplication', internalApplicationSchema);

module.exports = { InternalJob, InternalApplication };
