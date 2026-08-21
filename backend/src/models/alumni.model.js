/**
 * @fileoverview Alumni & Boomerang Rehire Schemas
 * @description Tracks ex-employee profiles, exit data, and rehire tenure reconciliation.
 * Issue: #1366
 */
const mongoose = require('mongoose');

const alumniProfileSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    originalEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    nationalId: { type: String, default: '', index: true }, // PAN/SSN for duplicate matching

    // Tenure Data
    originalJoinDate: { type: Date, required: true },
    exitDate: { type: Date, required: true },
    totalPreviousTenureDays: { type: Number, required: true },
    exitDepartment: { type: String, default: '' },
    exitRole: { type: String, default: '' },

    // Exit Interview & Status
    exitReason: { type: String, enum: ['Voluntary', 'Involuntary', 'Retirement', 'Layoff'], default: 'Voluntary' },
    isEligibleForRehire: { type: Boolean, default: true },
    exitInterviewSummary: { type: String, default: '' },

    // Rehire Linking
    isRehired: { type: Boolean, default: false },
    rehireEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    rehireDate: { type: Date, default: null }
}, { timestamps: true });

alumniProfileSchema.index({ tenantId: 1, nationalId: 1 });
const AlumniProfile = mongoose.model('AlumniProfile', alumniProfileSchema);

const boomerangRehireSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    alumniProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'AlumniProfile', required: true },
    newEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    // Reconciliation Data
    combinedTenureDays: { type: Number, required: true },
    restoredLeaveTier: { type: String, default: 'Standard' },
    restoredVestingSchedule: { type: Boolean, default: false },

    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const BoomerangRehire = mongoose.model('BoomerangRehire', boomerangRehireSchema);

module.exports = { AlumniProfile, BoomerangRehire };
