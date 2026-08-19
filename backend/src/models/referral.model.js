/**
 * @fileoverview Referral Program & Payout Schemas
 * @description Tracks internal referral bounties, candidate pipeline status, 
 * and milestone-based bonus payouts linked to payroll.
 * Issue: #1208
 */
const mongoose = require('mongoose');

/**
 * ReferralProgram Schema
 * Defines active bounties for specific roles or departments.
 */
const referralProgramSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true }, // e.g., "Senior Engineer Referral Drive"
    department: { type: String, default: 'All' },
    role: { type: String, default: 'All' },
    bountyAmount: { type: Number, required: true, min: 0 },

    // Milestone Split (e.g., 50% on join, 50% on probation complete)
    milestoneSplits: [
        { label: String, percentage: Number, trigger: String } // trigger: 'HIRED', 'PROBATION_COMPLETE'
    ],

    isActive: { type: Boolean, default: true },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date, default: null }
}, { timestamps: true });

const ReferralProgram = mongoose.model('ReferralProgram', referralProgramSchema);

/**
 * ReferralCandidate Schema
 * Tracks the referred individual and their progress through the hiring pipeline.
 */
const referralCandidateSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReferralProgram', required: true },
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    candidateName: { type: String, required: true },
    candidateEmail: { type: String, required: true },
    candidatePhone: { type: String, default: '' },
    resumeUrl: { type: String, default: '' },

    status: {
        type: String,
        enum: ['Submitted', 'Screening', 'Interviewing', 'Offered', 'Hired', 'Rejected'],
        default: 'Submitted',
        index: true
    },

    // Link to Employee record once hired (Critical for probation tracking)
    hiredEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    hiredAt: { type: Date, default: null },

    notes: { type: String, default: '' }
}, { timestamps: true });

referralCandidateSchema.index({ tenantId: 1, candidateEmail: 1 });
const ReferralCandidate = mongoose.model('ReferralCandidate', referralCandidateSchema);

/**
 * ReferralPayout Schema
 * Tracks individual milestone payouts for a specific referral.
 */
const referralPayoutSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReferralCandidate', required: true },
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    milestoneLabel: { type: String, required: true }, // e.g., "Joining Bonus"
    amount: { type: Number, required: true },

    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Paid', 'Forfeited'],
        default: 'Pending',
        index: true
    },

    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null },
    processedAt: { type: Date, default: null },
    forfeitureReason: { type: String, default: '' } // e.g., "Referred employee left before probation"
}, { timestamps: true });

const ReferralPayout = mongoose.model('ReferralPayout', referralPayoutSchema);

module.exports = { ReferralProgram, ReferralCandidate, ReferralPayout };
