/**
 * @fileoverview POSH Grievance & ICC Schemas
 * @description Cryptographically secure schemas for anonymous reporting and 
 * Internal Complaints Committee (ICC) case management.
 * Issue: #958
 */
const mongoose = require('mongoose');

const iccCommitteeSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['Presiding Officer', 'Internal Member', 'External Member'], required: true },
    isActive: { type: Boolean, default: true },
    decryptionPinHash: { type: String, required: true }, // Bcrypt hash of secondary PIN
}, { timestamps: true });

iccCommitteeSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
const ICCCommittee = mongoose.model('ICCCommittee', iccCommitteeSchema);

const grievanceSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    caseNumber: { type: String, required: true, unique: true }, // e.g., POSH-2024-001
    complainantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null }, // Null = Anonymous
    respondentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    incidentDate: { type: Date, required: true },
    // Encrypted fields (AES-256-GCM)
    encryptedDescription: { type: String, required: true },
    encryptionIV: { type: String, required: true },
    status: {
        type: String,
        enum: ['Filed', 'Under Inquiry', 'Resolved', 'Dismissed'],
        default: 'Filed'
    },
    filedAt: { type: Date, default: Date.now },
    slaDeadline: { type: Date, required: true }, // filedAt + 90 days
}, { timestamps: true });

grievanceSchema.index({ tenantId: 1, status: 1 });
const Grievance = mongoose.model('Grievance', grievanceSchema);

const caseNoteSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    grievanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grievance', required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Must be ICC member
    encryptedNote: { type: String, required: true },
    encryptionIV: { type: String, required: true },
    noteType: { type: String, enum: ['Hearing', 'Evidence', 'Finding', 'General'], default: 'General' },
}, { timestamps: true });

const CaseNote = mongoose.model('CaseNote', caseNoteSchema);

module.exports = { ICCCommittee, Grievance, CaseNote };
