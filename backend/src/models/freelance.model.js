/**
 * @fileoverview Freelance Escrow & Milestone Schemas
 * @description Tracks gig worker contracts, escrow ledgers, and milestone deliverables.
 * Issue: #1367
 */
const mongoose = require('mongoose');

/**
 * FreelanceContract Schema
 * Represents the master agreement and budget for a gig worker project.
 */
const freelanceContractSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractorId: { type: String, required: true }, // External contractor ID or email
    contractorName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    department: { type: String, required: true },

    // Financials
    totalBudget: { type: Number, required: true, min: 0 },
    departmentBudgetLimit: { type: Number, default: 1000000 }, // Guardrail limit
    platformFeeRate: { type: Number, default: 0.025 }, // 2.5% platform fee
    withholdingTaxRate: { type: Number, default: 0.10 }, // 10% TDS/Withholding

    // Escrow State
    fundedAmount: { type: Number, default: 0 },
    lockedAmount: { type: Number, default: 0 },
    releasedAmount: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['Draft', 'Funded', 'In Progress', 'Completed', 'Cancelled'],
        default: 'Draft',
        index: true
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const FreelanceContract = mongoose.model('FreelanceContract', freelanceContractSchema);

/**
 * EscrowLedger Schema
 * Immutable double-entry style ledger tracking all escrow movements.
 */
const escrowLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'FreelanceContract', required: true, index: true },

    transactionType: {
        type: String,
        enum: ['Initial Funding', 'Milestone Lock', 'Milestone Release', 'Fee Deduction', 'Refund'],
        required: true
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    description: { type: String, default: '' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

const EscrowLedger = mongoose.model('EscrowLedger', escrowLedgerSchema);

/**
 * MilestoneDeliverable Schema
 * Tracks individual project milestones and their approval status.
 */
const milestoneDeliverableSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'FreelanceContract', required: true, index: true },

    title: { type: String, required: true },
    description: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },

    // Deliverable Proof
    submissionUrl: { type: String, default: '' },
    submissionNotes: { type: String, default: '' },
    submittedAt: { type: Date, default: null },

    status: {
        type: String,
        enum: ['Pending', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid'],
        default: 'Pending',
        index: true
    },

    approvalNotes: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null }
}, { timestamps: true });

const MilestoneDeliverable = mongoose.model('MilestoneDeliverable', milestoneDeliverableSchema);

module.exports = { FreelanceContract, EscrowLedger, MilestoneDeliverable };
