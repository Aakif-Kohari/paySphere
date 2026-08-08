/**
 * @fileoverview Expense Claims Controller
 * @description Handles CRUD operations for expense claims, including receipt 
 * uploads, approval workflows, and status transitions.
 * 
 * Issue: #719
 */

const mongoose = require('mongoose');
const ExpenseClaim = require('../models/expenseClaim.model');
const ExpenseCategory = require('../models/expenseCategory.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');

/**
 * POST /api/expenses
 * Submit a new expense claim with receipts
 */
exports.submitExpense = async (req, res, next) => {
    try {
        const { employeeId, categoryId, amount, expenseDate, description } = req.body;

        if (!mongoose.Types.ObjectId.isValid(employeeId) || !mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'Invalid ID format' });
        }

        // Verify employee belongs to tenant
        const employee = await Employee.findOne({ _id: employeeId, tenantId: req.tenantId, isDeleted: { $ne: true } });
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        // Verify category belongs to tenant
        const category = await ExpenseCategory.findOne({ _id: categoryId, tenantId: req.tenantId, isActive: true });
        if (!category) return res.status(404).json({ message: 'Expense category not found or inactive' });

        // Process uploaded files (Multer)
        const receipts = (req.files || []).map(file => ({
            url: `/uploads/${file.filename}`,
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
        }));

        const claim = await ExpenseClaim.create({
            tenantId: req.tenantId,
            employeeId,
            categoryId,
            amount: Number(amount),
            currency: employee.currency || 'INR',
            expenseDate: new Date(expenseDate),
            description,
            receipts,
            status: 'pending_approval',
            submittedBy: req.userId,
        });

        eventBus.emit('AUDIT_LOG', {
            userId: req.userId,
            action: 'EXPENSE_SUBMIT',
            resourceType: 'ExpenseClaim',
            resourceIds: [claim._id],
            details: { employeeId, amount, category: category.name },
            req,
        });

        res.status(201).json({ message: 'Expense claim submitted successfully', claim });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/expenses
 * List expense claims (filtered by status, employee, etc.)
 */
exports.getExpenses = async (req, res, next) => {
    try {
        const { status, employeeId, page = 1, limit = 20 } = req.query;
        const query = { tenantId: req.tenantId };

        if (status) query.status = status;
        if (employeeId) query.employeeId = employeeId;

        const skip = (Number(page) - 1) * Number(limit);

        const [claims, total] = await Promise.all([
            ExpenseClaim.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('categoryId', 'name isTaxable')
                .populate('employeeId', 'fullName department')
                .lean(),
            ExpenseClaim.countDocuments(query),
        ]);

        res.status(200).json({
            claims,
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / Number(limit)),
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/expenses/:id/status
 * Approve or reject an expense claim
 */
exports.updateExpenseStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be approved or rejected' });
        }

        const claim = await ExpenseClaim.findOne({ _id: id, tenantId: req.tenantId });
        if (!claim) return res.status(404).json({ message: 'Expense claim not found' });

        if (claim.status !== 'pending_approval') {
            return res.status(409).json({ message: 'Claim has already been processed' });
        }

        claim.status = status;
        claim.approvedBy = req.userId;
        claim.approvedAt = new Date();

        if (status === 'rejected') {
            if (!rejectionReason) return res.status(400).json({ message: 'Rejection reason is required' });
            claim.rejectionReason = rejectionReason;
        }

        await claim.save();

        eventBus.emit('AUDIT_LOG', {
            userId: req.userId,
            action: status === 'approved' ? 'EXPENSE_APPROVE' : 'EXPENSE_REJECT',
            resourceType: 'ExpenseClaim',
            resourceIds: [claim._id],
            details: { amount: claim.amount, status },
            req,
        });

        res.status(200).json({ message: `Expense claim ${status}`, claim });
    } catch (error) {
        next(error);
    }
};
