/**
 * @fileoverview Expense Claims Controller
 * @description Handles CRUD operations for expense claims, including receipt
 * uploads, approval workflows, and status transitions, plus the categories a
 * claim has to be filed under.
 *
 * Issues: #719, #794.
 */

const mongoose = require('mongoose');
const ExpenseClaim = require('../models/expenseClaim.model');
const ExpenseCategory = require('../models/expenseCategory.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const { ACCOUNT_TYPE } = require('../config/accountTypes');
const { sanitizeText } = require('../utils/validators');

/** Claims that may still be edited or acted on. */
const PENDING = 'pending_approval';

/**
 * Which employee record, if any, this caller is allowed to file against.
 *
 * An EMPLOYEE account is a self-service login bound to one Employee record, so
 * it may file its own receipts and nobody else's. An ADMIN account is HR and may
 * file on anyone's behalf in its own tenant.
 *
 * Without this, holding WRITE_EXPENSE would be enough to submit a claim against
 * a colleague — the controller took `employeeId` straight from the body and
 * only checked that it belonged to the same tenant (#794).
 *
 * @param {object} req
 * @returns {string|null} the employee id the caller is pinned to, or null for "any"
 */
function pinnedEmployeeId(req) {
  if (req.accountType !== ACCOUNT_TYPE.EMPLOYEE) return null;

  return req.user?.employeeId ? String(req.user.employeeId) : null;
}

/**
 * POST /api/expenses
 * Submit a new expense claim with receipts
 */
exports.submitExpense = async (req, res, next) => {
  try {
    const { employeeId, categoryId, amount, expenseDate, description } =
      req.body;

    if (
      !mongoose.Types.ObjectId.isValid(employeeId) ||
      !mongoose.Types.ObjectId.isValid(categoryId)
    ) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const pinned = pinnedEmployeeId(req);
    if (pinned !== null && pinned !== String(employeeId)) {
      return res.status(403).json({
        message: 'You can only submit expense claims for yourself',
      });
    }

    // An employee login with no linked record has nothing it is allowed to file
    // against, and falling through would let it file against anyone.
    if (req.accountType === ACCOUNT_TYPE.EMPLOYEE && pinned === null) {
      return res.status(403).json({
        message: 'This account is not linked to an employee record',
      });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ message: 'Amount must be a number greater than zero' });
    }

    // `new Date(undefined)` is an Invalid Date, which mongoose casts to null and
    // then rejects with a validation error 40 lines later. Caught here so the
    // caller gets told which field is wrong.
    const parsedDate = new Date(expenseDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res
        .status(400)
        .json({ message: 'A valid expenseDate is required' });
    }

    if (!description || !String(description).trim()) {
      return res.status(400).json({ message: 'A description is required' });
    }

    // Verify employee belongs to tenant
    const employee = await Employee.findOne({
      _id: employeeId,
      tenantId: req.tenantId,
      isDeleted: { $ne: true },
    });
    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    // Verify category belongs to tenant
    const category = await ExpenseCategory.findOne({
      _id: categoryId,
      tenantId: req.tenantId,
      isActive: true,
    });
    if (!category)
      return res
        .status(404)
        .json({ message: 'Expense category not found or inactive' });

    // Process uploaded files (Multer). `file.filename` is the generated name on
    // disk; `originalname` is kept only as the label shown to a human.
    const receipts = (req.files || []).map((file) => ({
      url: `/uploads/receipts/${file.filename}`,
      filename: sanitizeText(String(file.originalname).slice(0, 255)),
      mimetype: file.mimetype,
      size: file.size,
    }));

    const claim = await ExpenseClaim.create({
      tenantId: req.tenantId,
      employeeId,
      categoryId,
      amount: parsedAmount,
      currency: employee.currency || 'INR',
      expenseDate: parsedDate,
      description: sanitizeText(String(description).slice(0, 1000)),
      receipts,
      status: PENDING,
      submittedBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EXPENSE_SUBMIT',
      resourceType: 'ExpenseClaim',
      resourceIds: [claim._id],
      details: { employeeId, amount: parsedAmount, category: category.name },
      req,
    });

    res
      .status(201)
      .json({ message: 'Expense claim submitted successfully', claim });
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

    if (employeeId) {
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return res.status(400).json({ message: 'Invalid employeeId' });
      }
      query.employeeId = employeeId;
    }

    // An employee login sees its own claims, whatever it asked for. Previously
    // the filter was taken at face value, so anyone with READ_EXPENSE could
    // page through every colleague's receipts — amounts, dates and descriptions
    // included (#794).
    const pinned = pinnedEmployeeId(req);
    if (pinned !== null) query.employeeId = pinned;
    else if (req.accountType === ACCOUNT_TYPE.EMPLOYEE) {
      return res.status(403).json({
        message: 'This account is not linked to an employee record',
      });
    }

    // An unbounded `limit` from the query string is a way to ask the server to
    // load the whole collection into memory. A nonsensical one — negative, zero,
    // not a number — falls back to the default rather than being clamped to 1,
    // which would silently paginate a list one row at a time.
    const positiveOr = (value, fallback, ceiling = Infinity) => {
      const parsed = Number.parseInt(value, 10);

      if (!Number.isFinite(parsed) || parsed < 1) return fallback;
      return Math.min(parsed, ceiling);
    };

    const parsedPage = positiveOr(page, 1);
    const parsedLimit = positiveOr(limit, 20, 100);
    const skip = (parsedPage - 1) * parsedLimit;

    const [claims, total] = await Promise.all([
      ExpenseClaim.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('categoryId', 'name isTaxable')
        .populate('employeeId', 'fullName department')
        .lean(),
      ExpenseClaim.countDocuments(query),
    ]);

    res.status(200).json({
      claims,
      pagination: {
        total,
        page: parsedPage,
        pageSize: parsedLimit,
        pages: Math.ceil(total / parsedLimit),
      },
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid claim ID format' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res
        .status(400)
        .json({ message: 'Status must be approved or rejected' });
    }

    const claim = await ExpenseClaim.findOne({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!claim)
      return res.status(404).json({ message: 'Expense claim not found' });

    if (claim.status !== PENDING) {
      return res
        .status(409)
        .json({ message: 'Claim has already been processed' });
    }

    // Maker-checker, the same separation #458 established for payroll: the
    // account that filed a claim cannot be the one that signs it off. Holding
    // both WRITE_EXPENSE and APPROVE_EXPENSE is normal for an owner working
    // alone, so the check is on the individual claim rather than on the role.
    if (String(claim.submittedBy) === String(req.userId)) {
      return res.status(403).json({
        message:
          'An expense claim must be approved by someone other than the person who submitted it',
      });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    claim.status = status;

    if (status === 'approved') {
      claim.approvedBy = req.userId;
      claim.approvedAt = new Date();
    } else {
      // Recorded on the fields that mean "rejected", not on the ones that mean
      // "approved". The original wrote approvedBy/approvedAt for both, so a
      // rejected claim carried an approver.
      claim.rejectedBy = req.userId;
      claim.rejectedAt = new Date();
      claim.rejectionReason = sanitizeText(
        String(rejectionReason).slice(0, 500),
      );
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

/**
 * GET /api/expenses/categories
 *
 * There was no way to read, and no way to create, the categories every claim is
 * required to reference — so the collection was empty on every install and the
 * first `POST /api/expenses` anyone could make was a guaranteed 404 (#794).
 */
exports.getCategories = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const query = { tenantId: req.tenantId };

    if (!includeInactive) query.isActive = true;

    const categories = await ExpenseCategory.find(query)
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/expenses/categories
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, isTaxable } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'A category name is required' });
    }

    const category = await ExpenseCategory.create({
      tenantId: req.tenantId,
      name: sanitizeText(String(name).trim().slice(0, 100)),
      description: description
        ? sanitizeText(String(description).slice(0, 500))
        : '',
      // Defaults to tax-free, matching the model: most reimbursements are the
      // employee being made whole rather than being paid.
      isTaxable: isTaxable === true || isTaxable === 'true',
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EXPENSE_CATEGORY_CREATE',
      resourceType: 'ExpenseCategory',
      resourceIds: [category._id],
      details: { name: category.name, isTaxable: category.isTaxable },
      req,
    });

    res.status(201).json({ message: 'Expense category created', category });
  } catch (error) {
    // The model declares { tenantId, name } unique, which is the check for
    // "this category already exists" — reported as a conflict rather than as an
    // unhandled driver error.
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A category with that name already exists' });
    }

    next(error);
  }
};

/**
 * PATCH /api/expenses/categories/:id
 *
 * Deactivation rather than deletion. A category is referenced by every claim
 * ever filed under it, and removing the row is what makes `populate` return
 * null in the payroll run.
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isTaxable, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid category ID format' });
    }

    const category = await ExpenseCategory.findOne({
      _id: id,
      tenantId: req.tenantId,
    });
    if (!category)
      return res.status(404).json({ message: 'Expense category not found' });

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ message: 'A category name is required' });
      }
      category.name = sanitizeText(String(name).trim().slice(0, 100));
    }

    if (description !== undefined) {
      category.description = sanitizeText(String(description).slice(0, 500));
    }

    if (isActive !== undefined) {
      category.isActive = isActive === true || isActive === 'true';
    }

    if (isTaxable !== undefined) {
      const next = isTaxable === true || isTaxable === 'true';

      // Flipping `isTaxable` changes how already-approved claims will be paid:
      // taxable ones go in as earnings before tax, tax-free ones are added to
      // net pay afterwards. Changing it under claims that are already waiting on
      // a payroll run would silently re-price them, so it is refused while any
      // are outstanding.
      if (next !== category.isTaxable) {
        const waiting = await ExpenseClaim.countDocuments({
          tenantId: req.tenantId,
          categoryId: category._id,
          status: { $in: [PENDING, 'approved'] },
          payrollId: null,
        });

        if (waiting > 0) {
          return res.status(409).json({
            message: `Cannot change isTaxable while ${waiting} claim(s) in this category are awaiting reimbursement`,
          });
        }

        category.isTaxable = next;
      }
    }

    await category.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'EXPENSE_CATEGORY_UPDATE',
      resourceType: 'ExpenseCategory',
      resourceIds: [category._id],
      details: {
        name: category.name,
        isTaxable: category.isTaxable,
        isActive: category.isActive,
      },
      req,
    });

    res.status(200).json({ message: 'Expense category updated', category });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'A category with that name already exists' });
    }

    logger.error('Failed to update expense category', {
      userId: req.userId,
      error: error.message,
    });
    next(error);
  }
};
