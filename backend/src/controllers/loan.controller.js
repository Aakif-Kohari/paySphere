const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const loanService = require('../services/loan.service');
/**
 * POST /api/loans — issue an advance or loan.
 */
exports.createLoan = async (req, res, next) => {
  try {
    const result = await loanService.createLoan(req.tenantId, req.userId, req.body || {});

    if (!result.ok) {
      const body = { message: result.message };
      if (result.errors) body.errors = result.errors;
      if (result.existingOutstanding !== undefined) body.existingOutstanding = result.existingOutstanding;
      if (result.cap !== undefined) body.cap = result.cap;
      return res.status(result.status).json(body);
    }

    const { employee, loan } = result;

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
    const result = await loanService.listLoans(req.tenantId, req.query);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    res.status(200).json({
      loans: result.loans,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      totalCount: result.totalCount,
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
    const result = await loanService.getLoanSummary(req.tenantId);

    res.status(200).json({
      totalCount: result.totalCount,
      totalOutstanding: result.totalOutstanding,
      byStatus: result.byStatus,
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
    const result = await loanService.getLoanDetail(req.tenantId, req.params.id);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    res.status(200).json({
      loan: result.loan,
      derivedOutstanding: result.derivedOutstanding,
      installmentsPaid: result.installmentsPaid,
      installmentsRemaining: result.installmentsRemaining,
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
    const result = await loanService.getLoanSchedule(req.tenantId, req.params.id);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    res.status(200).json({
      loanId: result.loanId,
      employeeName: result.employeeName,
      installmentAmount: result.installmentAmount,
      totalPayable: result.totalPayable,
      totalInterest: result.totalInterest,
      schedule: result.schedule,
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
    const result = loanService.previewLoanSchedule(req.body || {});

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message, errors: result.errors });
    }

    res.status(200).json({
      installmentAmount: result.installmentAmount,
      totalPayable: result.totalPayable,
      totalInterest: result.totalInterest,
      schedule: result.schedule,
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
    const target = req.body?.status;
    const result = await loanService.updateLoanStatus(
      req.tenantId,
      req.params.id,
      target,
      req.body?.note,
    );

    if (!result.ok) {
      const body = { message: result.message };
      if (result.currentStatus) body.currentStatus = result.currentStatus;
      return res.status(result.status).json(body);
    }

    const { loan, previous } = result;

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
    const result = await loanService.recordManualRepayment(
      req.tenantId,
      req.params.id,
      req.body,
    );

    if (!result.ok) {
      const body = { message: result.message };
      if (result.outstanding !== undefined) body.outstanding = result.outstanding;
      return res.status(result.status).json(body);
    }

    const { loan, amount, month, year } = result;

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