/**
 * @fileoverview OKR (Objectives and Key Results) Schemas
 * @description Supports hierarchical cascading (Company -> Dept -> Individual) 
 * and continuous progress tracking via check-ins.
 * Issue: #1168
 */
const mongoose = require('mongoose');

const keyResultSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    metricType: { type: String, enum: ['Percentage', 'Number', 'Currency', 'Boolean'], default: 'Percentage' },
    targetValue: { type: Number, required: true },
    currentValue: { type: Number, default: 0 },
    unit: { type: String, default: '' }, // e.g., '%', '$', 'users'
    progressPercent: { type: Number, default: 0, min: 0, max: 100 }
}, { _id: true });

const objectiveSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // Hierarchy & Ownership
    type: { type: String, enum: ['Company', 'Department', 'Individual'], required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Objective', default: null }, // For cascading
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    department: { type: String, default: '' }, // Relevant for Dept/Company OKRs

    cycle: { type: String, required: true }, // e.g., "Q3 2026", "FY 2026"

    keyResults: [keyResultSchema],

    // Aggregated Progress (0-100)
    overallProgress: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: ['On Track', 'At Risk', 'Off Track', 'Completed'], default: 'On Track' }
}, { timestamps: true });

objectiveSchema.index({ tenantId: 1, cycle: 1, type: 1 });
objectiveSchema.index({ parentId: 1 });
const Objective = mongoose.model('Objective', objectiveSchema);

const checkInSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    objectiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Objective', required: true, index: true },
    keyResultId: { type: mongoose.Schema.Types.ObjectId, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    previousValue: { type: Number, required: true },
    newValue: { type: Number, required: true },
    notes: { type: String, default: '' },
    blockedBy: { type: String, default: '' } // Cross-departmental dependency notes
}, { timestamps: true });

const CheckIn = mongoose.model('CheckIn', checkInSchema);

module.exports = { Objective, CheckIn };
