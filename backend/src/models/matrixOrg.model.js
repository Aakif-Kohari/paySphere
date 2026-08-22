/**
 * @fileoverview Matrix Organization & Cost Allocation Schemas
 * @description Maps employees to multiple cost centers/projects with percentage 
 * weights to enable split payroll journal entries.
 * Issue: #1292
 */
const mongoose = require('mongoose');

/**
 * MatrixAllocation Schema
 * Defines how an employee's salary cost is split across different departments or projects.
 */
const costCenterSplitSchema = new mongoose.Schema({
    costCenterName: { type: String, required: true }, // e.g., "Project Alpha", "R&D Dept"
    costCenterCode: { type: String, required: true }, // e.g., "PRJ-001", "DEPT-RND"
    percentageWeight: { type: Number, required: true, min: 0, max: 100 },
    glAccountCode: { type: String, default: '6000-Salaries' } // Target GL for debit
}, { _id: false });

const matrixAllocationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },

    // Administrative vs Operational Reporting
    administrativeManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    operationalManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },

    splits: [costCenterSplitSchema],

    // Dynamic Allocation Toggle
    useTimesheetAllocation: { type: Boolean, default: false }, // If true, % is derived from timesheet hours

    isActive: { type: Boolean, default: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null }
}, { timestamps: true });

const MatrixAllocation = mongoose.model('MatrixAllocation', matrixAllocationSchema);

/**
 * CostCenterJournal Schema
 * Stores the split journal entries generated during payroll processing.
 */
const costCenterJournalSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    costCenterCode: { type: String, required: true },
    costCenterName: { type: String, required: true },

    grossAmountAllocated: { type: Number, required: true },
    percentageApplied: { type: Number, required: true },

    generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

costCenterJournalSchema.index({ tenantId: 1, payrollRunId: 1 });
const CostCenterJournal = mongoose.model('CostCenterJournal', costCenterJournalSchema);

module.exports = { MatrixAllocation, CostCenterJournal };
