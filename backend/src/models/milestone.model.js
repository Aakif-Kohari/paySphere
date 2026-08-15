/**
 * @fileoverview Project Schema (Lightweight for Timesheet linkage)
 * @description Defines projects that gig-workers can log time or milestones against.
 * Issue: #1000
 */
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    clientName: { type: String, default: '' },
    budgetHours: { type: Number, default: 0 },
    budgetAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
