/**
 * @fileoverview Payroll Reversal Controller
 * @description Manages the lifecycle of payroll reversals, from initiation to journal approval.
 * Includes a guard to block subsequent payrolls if a reversal is pending.
 * Issue: #1166
 */
const mongoose = require('mongoose');
const { PayrollReversal } = require('../models/payrollReversal.model');
const PayrollUpdate = require('../models/payroll.model');
const {
    calculateReversalDeltas,
    generateNegativeJournals,
    generateClawbackSchedule,
    validateReversal
} = require('../utils/reversalEngine.utils');
const logger = require('../utils/logger');

exports.initiateReversal = async (req, res, next) => {
    try {
        const { originalPayrollId, correctedData, reason, recoveryMonths, startMonth, startYear } = req.body;

        const originalPayroll = await PayrollUpdate.findOne({ _id: originalPayrollId, tenantId: req.tenantId });
        const validation = validateReversal(originalPayroll);

        if (!validation.isValid) {
            return res.status(400).json({ message: validation.reason });
        }

        // Check for existing active reversals for this payroll
        const existingReversal = await PayrollReversal.findOne({
            originalPayrollId,
            tenantId: req.tenantId,
            status: { $nin: ['Cancelled', 'Fully Recovered'] }
        });

        if (existingReversal) {
            return res.status(409).json({ message: 'An active reversal already exists for this payroll run.' });
        }

        const deltas = calculateReversalDeltas(originalPayroll, correctedData);

        // Mock GL mappings for journal generation
        const glMappings = { salaryExpense: 'Salary Expense', tdsPayable: 'TDS Payable', salaryPayable: 'Employee Receivable' };
        const journalEntries = generateNegativeJournals(deltas, glMappings);

        const sMonth = Number(startMonth) || new Date().getMonth() + 1;
        const sYear = Number(startYear) || new Date().getFullYear();
        const schedule = generateClawbackSchedule(deltas.netOverpaid, recoveryMonths || 1, sMonth, sYear);

        const reversal = await PayrollReversal.create({
            tenantId: req.tenantId,
            employeeId: originalPayroll.employeeId,
            originalPayrollId: originalPayroll._id,
            ...deltas,
            reason,
            recoveryMonths: recoveryMonths || 1,
            clawbackSchedule: schedule,
            journalEntries,
            initiatedBy: req.userId,
            status: 'Pending Approval'
        });

        res.status(201).json({ message: 'Reversal initiated pending approval', reversal });
    } catch (error) { next(error); }
};

exports.getReversals = async (req, res, next) => {
    try {
        const reversals = await PayrollReversal.find({ tenantId: req.tenantId })
            .populate('employeeId', 'fullName department')
            .populate('originalPayrollId', 'month year netSalary')
            .sort({ createdAt: -1 });
        res.status(200).json({ reversals });
    } catch (error) { next(error); }
};

exports.approveReversal = async (req, res, next) => {
    try {
        const reversal = await PayrollReversal.findById(req.params.id);
        if (!reversal || reversal.status !== 'Pending Approval') {
            return res.status(400).json({ message: 'Reversal not found or not pending approval.' });
        }

        reversal.status = 'Recovery Active';
        reversal.approvedBy = req.userId;
        reversal.approvedAt = new Date();
        await reversal.save();

        // Mark original payroll as reversed to prevent duplicate reversals
        await PayrollUpdate.findByIdAndUpdate(reversal.originalPayrollId, { isReversed: true });

        logger.info(`[Reversal] Approved reversal ${reversal._id} for employee ${reversal.employeeId}`);
        res.status(200).json({ message: 'Reversal approved. Clawback schedule activated.', reversal });
    } catch (error) { next(error); }
};

exports.checkPayrollBlockGuard = async (req, res, next) => {
    try {
        // Guard to prevent next month's payroll if unresolved reversals exist
        const pendingReversals = await PayrollReversal.countDocuments({
            tenantId: req.tenantId,
            status: { $in: ['Pending Approval', 'Draft'] }
        });

        res.status(200).json({
            isBlocked: pendingReversals > 0,
            pendingCount: pendingReversals,
            message: pendingReversals > 0 ? `${pendingReversals} unresolved reversals pending. Resolve them before running next payroll.` : 'Clear to run payroll.'
        });
    } catch (error) { next(error); }
};
