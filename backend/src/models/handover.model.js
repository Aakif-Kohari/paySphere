/**
 * @fileoverview Offboarding Handover & Knowledge Transfer Schemas
 * @description Tracks task transitions, documentation links, physical asset returns,
 * and access revocation checklists during an employee's exit process.
 * Issue: #1205
 */
const mongoose = require('mongoose');

/**
 * KnowledgeTransfer Schema
 * Tracks specific documentation, code repos, and client contacts being handed over.
 */
const knowledgeTransferSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: {
        type: String,
        enum: ['Code Repository', 'Client Contact', 'Process Document', 'Credentials', 'Other'],
        required: true
    },
    link: { type: String, default: '' },
    attachmentUrl: { type: String, default: '' },
    isMandatory: { type: Boolean, default: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null }
}, { _id: true });

/**
 * AssetRecovery Schema
 * Tracks physical assets (laptops, keys, cards) assigned to the exiting employee.
 */
const assetRecoverySchema = new mongoose.Schema({
    assetName: { type: String, required: true },
    assetTag: { type: String, default: '' },
    condition: {
        type: String,
        enum: ['Pending Return', 'Returned Good', 'Returned Damaged', 'Lost'],
        default: 'Pending Return'
    },
    recoveryNotes: { type: String, default: '' },
    recoveredAt: { type: Date, default: null },
    payrollDeduction: { type: Number, default: 0 } // If lost/damaged
}, { _id: true });

/**
 * AccessRevocation Schema
 * Tracks IT system access that needs to be revoked.
 */
const accessRevocationSchema = new mongoose.Schema({
    systemName: { type: String, required: true }, // e.g., 'AWS Console', 'GitHub', 'Slack'
    accessLevel: { type: String, default: 'Standard' },
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { _id: true });

/**
 * HandoverPlan Schema
 * The master document tracking the entire offboarding workflow for a specific exit.
 */
const handoverPlanSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    exitDate: { type: Date, required: true },

    // Sub-documents
    knowledgeTransfers: [knowledgeTransferSchema],
    assetRecoveries: [assetRecoverySchema],
    accessRevocations: [accessRevocationSchema],

    // Sign-offs
    employeeSignOff: { type: Boolean, default: false },
    employeeSignOffDate: { type: Date, default: null },
    managerSignOff: { type: Boolean, default: false },
    managerSignOffDate: { type: Date, default: null },
    managerRemarks: { type: String, default: '' },
    itSignOff: { type: Boolean, default: false },
    itSignOffDate: { type: Date, default: null },

    // Clearance Metrics
    clearanceScore: { type: Number, default: 0, min: 0, max: 100 },
    status: {
        type: String,
        enum: ['In Progress', 'Pending Manager Review', 'Pending IT Review', 'Cleared', 'Blocked'],
        default: 'In Progress',
        index: true
    },

    // F&F Integration
    isFnFBlocked: { type: Boolean, default: true }
}, { timestamps: true });

handoverPlanSchema.index({ tenantId: 1, status: 1 });
const HandoverPlan = mongoose.model('HandoverPlan', handoverPlanSchema);

module.exports = { HandoverPlan };
