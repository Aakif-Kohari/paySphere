/**
 * @fileoverview Relocation Controller
 * @description Manages relocation requests, expense uploads, and gross-up calculations.
 * Issue: #1368
 */
const { RelocationRequest, RelocationExpense, TaxGrossUp } = require('../models/relocation.model');
const Employee = require('../models/employee.model');
const { calculateGrossUp, isExpenseTaxable } = require('../utils/grossUpCalculator.utils');
const logger = require('../utils/logger');

exports.createRequest = async (req, res, next) => {
    try {
        const { originCity, destinationCity, relocationDate, approvedBudget, marginalTaxRate } = req.body;
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const request = await RelocationRequest.create({
            tenantId: req.tenantId,
            employeeId: employee._id,
            originCity, destinationCity, relocationDate: new Date(relocationDate),
            approvedBudget, marginalTaxRate: marginalTaxRate || 0.30
        });

        res.status(201).json({ message: 'Relocation request submitted', request });
    } catch (error) { next(error); }
};

exports.submitExpense = async (req, res, next) => {
    try {
        const { requestId, category, amount, receiptUrl, description } = req.body;
        const request = await RelocationRequest.findOne({ _id: requestId, tenantId: req.tenantId });
        if (!request) return res.status(404).json({ message: 'Request not found' });

        // Determine taxability based on category and cross-border status (mocked here as false)
        const isCrossBorder = false; // In real app, compare country codes of cities
        const taxable = isExpenseTaxable(category, isCrossBorder);

        const expense = await RelocationExpense.create({
            tenantId: req.tenantId,
            requestId,
            category,
            amount,
            receiptUrl,
            description,
            isTaxable: taxable,
            status: 'Approved' // Auto-approve for demo, or route to manager
        });

        res.status(201).json({ message: 'Expense submitted', expense, isTaxable: taxable });
    } catch (error) { next(error); }
};

exports.calculateGrossUps = async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const request = await RelocationRequest.findOne({ _id: requestId, tenantId: req.tenantId });
        if (!request) return res.status(404).json({ message: 'Request not found' });

        // Fetch all approved taxable expenses for this request
        const expenses = await RelocationExpense.find({ requestId, status: 'Approved', isTaxable: true });
        const totalTaxableExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        const grossUpData = calculateGrossUp(totalTaxableExpenses, request.marginalTaxRate);

        // Upsert the gross-up record
        const grossUp = await TaxGrossUp.findOneAndUpdate(
            { requestId },
            {
                tenantId: req.tenantId,
                totalTaxableExpenses,
                grossUpAmount: grossUpData.grossUpAmount,
                taxRateApplied: request.marginalTaxRate
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Gross-up calculated', grossUp, grossUpData });
    } catch (error) { next(error); }
};

exports.injectToPayroll = async (req, res, next) => {
    try {
        const { requestId } = req.params;
        const grossUp = await TaxGrossUp.findOne({ requestId, tenantId: req.tenantId });
        if (!grossUp) return res.status(404).json({ message: 'Gross-up record not found. Calculate first.' });

        if (grossUp.isInjectedToPayroll) {
            return res.status(400).json({ message: 'Already injected into payroll.' });
        }

        // In a real system, this would push line items to the PayrollUpdate model:
        // 1. Relocation Reimbursement (Non-taxable portion)
        // 2. Relocation Gross-Up Bonus (Taxable)
        // 3. TDS on Gross-Up

        grossUp.isInjectedToPayroll = true;
        await grossUp.save();

        logger.info(`[Relocation] Injected gross-up of ${grossUp.grossUpAmount} to payroll for request ${requestId}`);
        res.status(200).json({ message: 'Successfully injected into next payroll run.', grossUp });
    } catch (error) { next(error); }
};

exports.getMyRequests = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

        const requests = await RelocationRequest.find({ employeeId: employee._id, tenantId: req.tenantId }).sort({ createdAt: -1 });

        // Fetch expenses and gross-ups for these requests
        const requestIds = requests.map(r => r._id);
        const expenses = await RelocationExpense.find({ requestId: { $in: requestIds } });
        const grossUps = await TaxGrossUp.find({ requestId: { $in: requestIds } });

        res.status(200).json({ requests, expenses, grossUps });
    } catch (error) { next(error); }
};
