const mongoose = require('mongoose');
const Loan = require('../models/loan.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const { sanitizeText } = require('../utils/validators');
const {
  LOAN_TYPE,
  LOAN_STATUS,
  buildAmortizationSchedule,
  computeOutstanding,
  applyRepayment,
  canTransitionStatus,
  round2,
} = require('../utils/loanSchedule');

/**
 * How many months of salary an employee may hold as an outstanding advance.
 *
 * A guard rather than a rule: an advance larger than several months' pay cannot
 * realistically be recovered from that salary, and the resulting instalment
 * would be capped away every month while the balance never moved.
 */
const MAX_SALARY_MULTIPLE = 6;

/**
 * Load an employee, asserting the caller owns it.
 *
 * @param {string} employeeId
 * @param {string} userId
 * @returns {Promise<{ok: true, employee: object} | {ok: false, status: number, message: string}>}
 */
async function loadOwnedEmployee(employeeId, userId) {
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return { ok: false, status: 400, message: 'Invalid employee id format' };
  }

  const employee = await Employee.findOne({ _id: employeeId, createdBy: userId });

  if (!employee) {
    // Indistinguishable from "does not exist", so the caller cannot probe for
    // another company's employees.
    return { ok: false, status: 404, message: 'Employee not found' };
  }

  return { ok: true, employee };
}

/**
 * Load a loan, asserting the caller owns it.
 *
 * @param {string} loanId
 * @param {string} userId
 * @returns {Promise<{ok: true, loan: object} | {ok: false, status: number, message: string}>}
 */
async function loadOwnedLoan(loanId, userId) {
  if (!mongoose.Types.ObjectId.isValid(loanId)) {
    return { ok: false, status: 400, message: 'Invalid loan id format' };
  }

  const loan = await Loan.findOne({ _id: loanId, createdBy: userId });

  if (!loan) {
    return { ok: false, status: 404, message: 'Loan not found' };
  }

  return { ok: true, loan };
}

/**
 * POST /api/loans — issue an advance or loan.
 */
exports.createLoan = async (req, res, next) => {
  try {
    const body = req.body || {};

    const owned = await loadOwnedEmployee(body.employeeId, req.userId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { employee } = owned;
    const now = new Date();

    const terms = {
      principal: Number(body.principal),
      tenureMonths: Number(body.tenureMonths),
      interestMethod: body.interestMethod,
      interestRatePercent: Number(body.interestRatePercent) || 0,
      startMonth:
        body.startMonth !== undefined ? Number(body.startMonth) : now.getMonth() + 1,
      startYear:
        body.startYear !== undefined ? Number(body.startYear) : now.getFullYear(),
    };

    const built = buildAmortizationSchedule(terms);

    if (!built.ok) {
      return res.status(400).json({
        message: 'Invalid loan terms',
        errors: built.errors,
      });
    }

    // An advance larger than a few months' salary cannot be recovered from that
    // salary — the instalment would be capped away every month while the
    // balance stood still.
    const salaryCap = round2(
      (Number(employee.monthlySalary) || 0) * MAX_SALARY_MULTIPLE,
    );

    const existingOutstanding = (
      await Loan.find({
        employeeId: employee._id,
        tenantId: req.tenantId,
        status: { $in: [LOAN_STATUS.ACTIVE, LOAN_STATUS.ON_HOLD] },
      }).select('outstanding')
    ).reduce((sum, l) => sum + (Number(l.outstanding) || 0), 0);

    const projected = round2(existingOutstanding + terms.principal);

    if (salaryCap > 0 && projected > salaryCap) {
      return res.status(400).json({
        message: `Total outstanding advances (${projected}) would exceed ${MAX_SALARY_MULTIPLE}x monthly salary (${salaryCap})`,
        existingOutstanding: round2(existingOutstanding),
        cap: salaryCap,
      });
    }

    const loan = await Loan.create({
      employeeId: employee._id,
      employeeName: employee.fullName,
      tenantId: req.tenantId,
      type: Object.values(LOAN_TYPE).includes(body.type)
        ? body.type
        : LOAN_TYPE.ADVANCE,
      principal: built.schedule.length ? terms.principal : 0,
      interestMethod: terms.interestMethod,
      interestRatePercent: terms.interestRatePercent,
      tenureMonths: terms.tenureMonths,
      installmentAmount: built.installmentAmount,
      totalPayable: built.totalPayable,
      totalInterest: built.totalInterest,
      startMonth: terms.startMonth,
      startYear: terms.startYear,
      schedule: built.schedule,
      status: LOAN_STATUS.ACTIVE,
      repayments: [],
      totalRepaid: 0,
      outstanding: built.totalPayable,
      reason: sanitizeText(body.reason || ''),
      approvedBy: req.userId,
      approvedAt: new Date(),
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LOAN_ISSUE',
      resourceType: 'Loan',
      resourceIds: [loan._id],
      details: {
        employeeName: employee.fullName,
        type: loan.type,
        principal: loan.principal,
        tenureMonths: loan.tenureMonths,
        installmentAmount: loan.installmentAmount,
      },
      req,
    });

    logger.info('Loan issued', {
      userId: req.userId,
      loanId: loan._id,
      employeeId: String(employee._id),
      principal: loan.principal,
    });

    res.status(201).json({ message: 'Loan issued successfully', loan });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/loans — list, filtered and paginated.
 */
exports.getLoans = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 20;

    const query = { tenantId: req.tenantId };

    if (req.query.status) {
      if (!Object.values(LOAN_STATUS).includes(req.query.status)) {
        return res.status(400).json({ message: 'Invalid status filter' });
      }
      query.status = req.query.status;
    }

    if (req.query.employeeId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.employeeId)) {
        return res.status(400).json({ message: 'Invalid employee id format' });
      }
      query.employeeId = req.query.employeeId;
    }

    const [loans, totalCount] = await Promise.all([
      Loan.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        // The full schedule can be 120 rows; the list view does not need it.
        .select('-schedule'),
      Loan.countDocuments(query),
    ]);

    res.status(200).json({
      loans,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 0,
      totalCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/loans/summary — outstanding totals for the dashboard.
 */
exports.getLoanSummary = async (req, res, next) => {
  try {
    const rows = await Loan.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(req.userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          outstanding: { $sum: '$outstanding' },
          principal: { $sum: '$principal' },
        },
      },
    ]);

    const byStatus = {};
    let totalOutstanding = 0;
    let totalCount = 0;

    rows.forEach((row) => {
      byStatus[row._id] = {
        count: row.count,
        outstanding: round2(row.outstanding),
        principal: round2(row.principal),
      };
      totalCount += row.count;
      if (row._id === LOAN_STATUS.ACTIVE || row._id === LOAN_STATUS.ON_HOLD) {
        totalOutstanding += row.outstanding;
      }
    });

    res.status(200).json({
      totalCount,
      totalOutstanding: round2(totalOutstanding),
      byStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/loans/:id — detail, with the schedule and the ledger.
 */
exports.getLoanById = async (req, res, next) => {
  try {
    const owned = await loadOwnedLoan(req.params.id, req.userId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { loan } = owned;

    res.status(200).json({
      loan,
      // Recomputed from the ledger rather than read from the stored field, so
      // a drift between the two is visible instead of silent.
      derivedOutstanding: computeOutstanding(loan),
      installmentsPaid: loan.repayments.length,
      installmentsRemaining: Math.max(
        loan.tenureMonths - loan.repayments.length,
        0,
      ),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/loans/:id/schedule — the projected amortisation table.
 */
exports.getLoanSchedule = async (req, res, next) => {
  try {
    const owned = await loadOwnedLoan(req.params.id, req.userId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { loan } = owned;

    // Annotate each projected row with what was actually collected, so the UI
    // can show planned vs actual side by side.
    const paidByPeriod = new Map(
      loan.repayments.map((r) => [`${r.year}-${r.month}`, r]),
    );

    const schedule = loan.schedule.map((row) => {
      const paid = paidByPeriod.get(`${row.year}-${row.month}`);
      return {
        ...(row.toObject ? row.toObject() : row),
        paid: Boolean(paid),
        paidAmount: paid ? paid.amount : 0,
      };
    });

    res.status(200).json({
      loanId: String(loan._id),
      employeeName: loan.employeeName,
      installmentAmount: loan.installmentAmount,
      totalPayable: loan.totalPayable,
      totalInterest: loan.totalInterest,
      schedule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/loans/preview — model the terms without writing anything.
 */
exports.previewLoanSchedule = async (req, res, next) => {
  try {
    const body = req.body || {};
    const now = new Date();

    const built = buildAmortizationSchedule({
      principal: Number(body.principal),
      tenureMonths: Number(body.tenureMonths),
      interestMethod: body.interestMethod,
      interestRatePercent: Number(body.interestRatePercent) || 0,
      startMonth:
        body.startMonth !== undefined ? Number(body.startMonth) : now.getMonth() + 1,
      startYear:
        body.startYear !== undefined ? Number(body.startYear) : now.getFullYear(),
    });

    if (!built.ok) {
      return res
        .status(400)
        .json({ message: 'Invalid loan terms', errors: built.errors });
    }

    res.status(200).json({
      installmentAmount: built.installmentAmount,
      totalPayable: built.totalPayable,
      totalInterest: built.totalInterest,
      schedule: built.schedule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/loans/:id/status — hold, resume or cancel.
 */
exports.updateLoanStatus = async (req, res, next) => {
  try {
    const owned = await loadOwnedLoan(req.params.id, req.userId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { loan } = owned;
    const target = req.body?.status;

    if (!Object.values(LOAN_STATUS).includes(target)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${Object.values(LOAN_STATUS).join(', ')}`,
      });
    }

    if (!canTransitionStatus(loan.status, target)) {
      // A settled or cancelled loan is terminal: reopening it would let an
      // employer resume collecting against a balance of zero.
      return res.status(409).json({
        message: `A loan that is "${loan.status}" cannot move to "${target}"`,
        currentStatus: loan.status,
      });
    }

    const previous = loan.status;
    loan.status = target;
    loan.statusNote = sanitizeText(req.body?.note || '');

    if (target === LOAN_STATUS.CANCELLED) loan.cancelledAt = new Date();
    if (target === LOAN_STATUS.COMPLETED) loan.completedAt = new Date();

    await loan.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LOAN_STATUS_CHANGE',
      resourceType: 'Loan',
      resourceIds: [loan._id],
      details: {
        employeeName: loan.employeeName,
        from: previous,
        to: target,
        outstanding: loan.outstanding,
      },
      req,
    });

    logger.info('Loan status changed', {
      userId: req.userId,
      loanId: loan._id,
      from: previous,
      to: target,
    });

    res.status(200).json({ message: `Loan ${target}`, loan });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/loans/:id/repay — record an off-cycle lump-sum repayment.
 */
exports.recordManualRepayment = async (req, res, next) => {
  try {
    const owned = await loadOwnedLoan(req.params.id, req.userId);
    if (!owned.ok) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const { loan } = owned;

    if (loan.status === LOAN_STATUS.CANCELLED || loan.status === LOAN_STATUS.COMPLETED) {
      return res.status(409).json({
        message: `Cannot record a repayment against a loan that is "${loan.status}"`,
      });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    const outstanding = computeOutstanding(loan);
    if (amount > outstanding) {
      // Over-collecting is the failure this whole feature exists to prevent.
      return res.status(400).json({
        message: `Amount exceeds the outstanding balance of ${outstanding}`,
        outstanding,
      });
    }

    const now = new Date();
    const month = req.body?.month ? Number(req.body.month) : now.getMonth() + 1;
    const year = req.body?.year ? Number(req.body.year) : now.getFullYear();

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month' });
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year' });
    }

    const applied = applyRepayment(loan, { month, year, amount });

    loan.repayments = applied.repayments;
    loan.totalRepaid = applied.totalRepaid;
    loan.outstanding = applied.outstanding;
    loan.status = applied.status;
    if (applied.status === LOAN_STATUS.COMPLETED && !loan.completedAt) {
      loan.completedAt = new Date();
    }

    await loan.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'LOAN_REPAYMENT',
      resourceType: 'Loan',
      resourceIds: [loan._id],
      details: {
        employeeName: loan.employeeName,
        amount,
        month,
        year,
        outstanding: loan.outstanding,
        source: 'manual',
      },
      req,
    });

    res.status(200).json({
      message: 'Repayment recorded',
      loan,
      outstanding: loan.outstanding,
    });
  } catch (error) {
    next(error);
  }
};

exports._internals = { loadOwnedEmployee, loadOwnedLoan, MAX_SALARY_MULTIPLE };
