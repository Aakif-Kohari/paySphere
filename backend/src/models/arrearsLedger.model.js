/**
 * @fileoverview Arrears Ledger Schema
 * @description Tracks financial deltas caused by backdated salary revisions.
 * Prevents double-payout by linking to the payroll run that released the arrears.
 * Issue: #931
 */
const mongoose = require('mongoose');

const arrearsLedgerSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
        revisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryStructure', required: true },
        targetMonth: { type: Number, required: true, min: 1, max: 12 },
        targetYear: { type: Number, required: true },
        oldGross: { type: Number, required: true },
        newGross: { type: Number, required: true },
        grossDelta: { type: Number, required: true },
        proRatedDays: { type: Number, default: null }, // Null if full month
        totalDaysInMonth: { type: Number, required: true },
        netArrearsPayout: { type: Number, required: true }, // Final amount to add to payslip
        isReleased: { type: Boolean, default: false, index: true },
        releasedInPayrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null },
    },
    { timestamps: true }
);

// Prevent duplicate arrears entries for the same employee/month/revision
arrearsLedgerSchema.index({ employeeId: 1, targetMonth: 1, targetYear: 1, revisionId: 1 }, { unique: true });

module.exports = mongoose.model('ArrearsLedger', arrearsLedgerSchema);
