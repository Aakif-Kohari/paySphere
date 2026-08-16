const mongoose = require('mongoose');
const Loan = require('../models/loan.model');
const Employee = require('../models/employee.model');
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
 * Loan domain logic: validation, computation and persistence, decoupled from
 * HTTP so it can be unit tested and reused outside the loan controller.
 * Methods return a plain result object ({ ok, status, message, ... }) rather
 * than throwing, so callers can map it onto a response without a try/catch
 * per validation branch.
 */
class LoanService {
  /**
   * Load an employee, asserting it belongs to the caller's company.
   *
   * Scoped by tenant, not by creator. #585 moved the writes to `tenantId` but
   * left this lookup on `createdBy`, so every employee added after it became
   * invisible to the loan endpoints — the row had no `createdBy` to match (#613).
   *
   * @param {string} employeeId
   * @param {string} tenantId
   * @returns {Promise<{ok: true, employee: object} | {ok: false, status: number, message: string}>}
   */
  async loadOwnedEmployee(employeeId, tenantId) {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return { ok: false, status: 400, message: 'Invalid employee id format' };
    }

    const employee = await Employee.findOne({ _id: employeeId, tenantId });

    if (!employee) {
      // Indistinguishable from "does not exist", so the caller cannot probe for
      // another company's employees.
      return { ok: false, status: 404, message: 'Employee not found' };
    }

    return { ok: true, employee };
  }

  /**
   * Load a loan, asserting it belongs to the caller's company.
   *
   * @param {string} loanId
   * @param {string} tenantId
   * @returns {Promise<{ok: true, loan: object} | {ok: false, status: number, message: string}>}
   */
  async loadOwnedLoan(loanId, tenantId) {
    if (!mongoose.Types.ObjectId.isValid(loanId)) {
      return { ok: false, status: 400, message: 'Invalid loan id format' };
    }

    const loan = await Loan.findOne({ _id: loanId, tenantId });

    if (!loan) {
      return { ok: false, status: 404, message: 'Loan not found' };
    }

    return { ok: true, loan };
  }

  /**
   * Issue an advance or loan for an employee.
   */
  async createLoan(tenantId, userId, body) {
    const owned = await this.loadOwnedEmployee(body.employeeId, tenantId);
    if (!owned.ok) return owned;

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
      return { ok: false, status: 400, message: 'Invalid loan terms', errors: built.errors };
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
        tenantId,
        status: { $in: [LOAN_STATUS.ACTIVE, LOAN_STATUS.ON_HOLD] },
      }).select('outstanding')
    ).reduce((sum, l) => sum + (Number(l.outstanding) || 0), 0);

    const projected = round2(existingOutstanding + terms.principal);

    if (salaryCap > 0 && projected > salaryCap) {
      return {
        ok: false,
        status: 400,
        message: `Total outstanding advances (${projected}) would exceed ${MAX_SALARY_MULTIPLE}x monthly salary (${salaryCap})`,
        existingOutstanding: round2(existingOutstanding),
        cap: salaryCap,
      };
    }

    const loan = await Loan.create({
      employeeId: employee._id,
      employeeName: employee.fullName,
      // Both: `createdBy` records who issued it, `tenantId` decides who can see
      // it. #585 dropped the first while the schema still required it, so this
      // create() threw a ValidationError on every call (#613).
      createdBy: userId,
      tenantId,
      type: Object.values(LOAN_TYPE).includes(body.type) ? body.type : LOAN_TYPE.ADVANCE,
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
      approvedBy: userId,
      approvedAt: new Date(),
    });

    return { ok: true, employee, loan };
  }

  /**
   * List loans for a tenant, filtered and paginated.
   */
  async listLoans(tenantId, queryParams) {
    let page = parseInt(queryParams.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(queryParams.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 20;

    const query = { tenantId };

    if (queryParams.status) {
      if (!Object.values(LOAN_STATUS).includes(queryParams.status)) {
        return { ok: false, status: 400, message: 'Invalid status filter' };
      }
      query.status = queryParams.status;
    }

    if (queryParams.employeeId) {
      if (!mongoose.Types.ObjectId.isValid(queryParams.employeeId)) {
        return { ok: false, status: 400, message: 'Invalid employee id format' };
      }
      query.employeeId = queryParams.employeeId;
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

    return {
      ok: true,
      loans,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 0,
      totalCount,
    };
  }

  /**
   * Outstanding totals for the dashboard.
   */
  async getLoanSummary(tenantId) {
    const rows = await Loan.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
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

    return { ok: true, totalCount, totalOutstanding: round2(totalOutstanding), byStatus };
  }

  /**
   * Loan detail, with the ledger recomputed from source.
   */
  async getLoanDetail(tenantId, loanId) {
    const owned = await this.loadOwnedLoan(loanId, tenantId);
    if (!owned.ok) return owned;

    const { loan } = owned;

    return {
      ok: true,
      loan,
      // Recomputed from the ledger rather than read from the stored field, so
      // a drift between the two is visible instead of silent.
      derivedOutstanding: computeOutstanding(loan),
      installmentsPaid: loan.repayments.length,
      installmentsRemaining: Math.max(loan.tenureMonths - loan.repayments.length, 0),
    };
  }

  /**
   * The projected amortisation table, annotated with what was actually paid.
   */
  async getLoanSchedule(tenantId, loanId) {
    const owned = await this.loadOwnedLoan(loanId, tenantId);
    if (!owned.ok) return owned;

    const { loan } = owned;

    // Annotate each projected row with what was actually collected, so the UI
    // can show planned vs actual side by side.
    const paidByPeriod = new Map(loan.repayments.map((r) => [`${r.year}-${r.month}`, r]));

    const schedule = loan.schedule.map((row) => {
      const paid = paidByPeriod.get(`${row.year}-${row.month}`);
      return {
        ...(row.toObject ? row.toObject() : row),
        paid: Boolean(paid),
        paidAmount: paid ? paid.amount : 0,
      };
    });

    return {
      ok: true,
      loanId: String(loan._id),
      employeeName: loan.employeeName,
      installmentAmount: loan.installmentAmount,
      totalPayable: loan.totalPayable,
      totalInterest: loan.totalInterest,
      schedule,
    };
  }

  /**
   * Model loan terms without writing anything.
   */
  previewLoanSchedule(body) {
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
      return { ok: false, status: 400, message: 'Invalid loan terms', errors: built.errors };
    }

    return {
      ok: true,
      installmentAmount: built.installmentAmount,
      totalPayable: built.totalPayable,
      totalInterest: built.totalInterest,
      schedule: built.schedule,
    };
  }

  /**
   * Hold, resume or cancel a loan.
   */
  async updateLoanStatus(tenantId, loanId, target, note) {
    const owned = await this.loadOwnedLoan(loanId, tenantId);
    if (!owned.ok) return owned;

    const { loan } = owned;

    if (!Object.values(LOAN_STATUS).includes(target)) {
      return {
        ok: false,
        status: 400,
        message: `Invalid status. Must be one of: ${Object.values(LOAN_STATUS).join(', ')}`,
      };
    }

    if (!canTransitionStatus(loan.status, target)) {
      // A settled or cancelled loan is terminal: reopening it would let an
      // employer resume collecting against a balance of zero.
      return {
        ok: false,
        status: 409,
        message: `A loan that is "${loan.status}" cannot move to "${target}"`,
        currentStatus: loan.status,
      };
    }

    const previous = loan.status;
    loan.status = target;
    loan.statusNote = sanitizeText(note || '');

    if (target === LOAN_STATUS.CANCELLED) loan.cancelledAt = new Date();
    if (target === LOAN_STATUS.COMPLETED) loan.completedAt = new Date();

    await loan.save();

    return { ok: true, loan, previous, target };
  }

  /**
   * Record an off-cycle lump-sum repayment.
   */
  async recordManualRepayment(tenantId, loanId, body) {
    const owned = await this.loadOwnedLoan(loanId, tenantId);
    if (!owned.ok) return owned;

    const { loan } = owned;

    if (loan.status === LOAN_STATUS.CANCELLED || loan.status === LOAN_STATUS.COMPLETED) {
      return {
        ok: false,
        status: 409,
        message: `Cannot record a repayment against a loan that is "${loan.status}"`,
      };
    }

    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, status: 400, message: 'Amount must be a positive number' };
    }

    const outstanding = computeOutstanding(loan);
    if (amount > outstanding) {
      // Over-collecting is the failure this whole feature exists to prevent.
      return {
        ok: false,
        status: 400,
        message: `Amount exceeds the outstanding balance of ${outstanding}`,
        outstanding,
      };
    }

    const now = new Date();
    const month = body?.month ? Number(body.month) : now.getMonth() + 1;
    const year = body?.year ? Number(body.year) : now.getFullYear();

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return { ok: false, status: 400, message: 'Invalid month' };
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { ok: false, status: 400, message: 'Invalid year' };
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

    return { ok: true, loan, amount, month, year };
  }
}

module.exports = new LoanService();
module.exports.LoanService = LoanService;