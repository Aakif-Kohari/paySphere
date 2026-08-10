// `tax.service` and `anomaly.service` were required here by the #693
// scaffolding and never called. Left in place they are two more modules loaded
// on every payroll request for nothing, and `anomaly.service` in particular has
// a broken require of its own that this file was propagating to app.js at boot
// (#792). Dropped rather than wired up: neither has an implementation to call.
const crypto = require('crypto');
const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const User = require('../models/user.model');
const { calculateNetSalary } = require('../utils/salaryCalculator');
const { generatePayrollCSV } = require('../utils/csvExport');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const cacheService = require('../services/cache.service');
const AnomalyService = require('../services/anomaly.service');
const FXService = require('../services/fx.service');
// `webhookService` was imported for the stray `triggerEvent` call #543 left in
// the middle of submitPayrollForReview. That call is gone (see below) and the
// service has never exported `triggerEvent` anyway — payroll webhooks are
// delivered by its AUDIT_LOG subscription, which needs nothing from here.
// Restored: this import was dropped when #464 was merged into main via the
// GitHub conflict editor, leaving PAYROLL_STATUS, payableStatusFilter and
// friends undefined — every summary, export, payslip email and approval call
// throws a ReferenceError without it (#458).
const {
  PAYROLL_STATUS,
  canTransition,
  describeTransition,
  isEmailable,
  normalizeStatus,
  payableStatusFilter,
  excludeRejectedFilter,
} = require('../config/payrollStatus');
const Attendance = require('../models/attendance.model');
const { derivePayrollInputs } = require('../utils/attendanceGrid');
const Loan = require('../models/loan.model');
const {
  LOAN_STATUS,
  allocateRecovery,
  applyRepayment,
} = require('../utils/loanSchedule');
const SalaryStructure = require('../models/salaryStructure.model');
const {
  resolveStructureForPeriod,
  computeComponentAmounts,
} = require('../utils/salaryStructure');
const { requireTenant } = require('../utils/tenantScope');
const {
  parseDepartments,
  resolveDepartmentEmployeeIds,
  applyEmployeeFilter,
} = require('../utils/departmentFilter');

// Also dropped by the #464 merge alongside the payrollStatus import: both are
// referenced by parsePayrollIdBatch and rejectPayroll (#458).
const MAX_BATCH_SIZE = 200;
const MAX_REJECTION_REASON_LENGTH = 500;

// Helper: parse tag labels back into structured numbers
function parseTagValue(label) {
  if (typeof label !== 'string') return 0;
  const num = label.replace(/[^0-9.]/g, '');
  if (!num) return 0;
  const parsed = parseFloat(num);
  return isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0 ? 0 : parsed;
}

/**
 * Validate a batch of payroll ids supplied in a request body.
 *
 * The approval handlers took `payrollIds` straight from the body and fed it to
 * `updateMany`. A non-ObjectId string throws a CastError that surfaces as a
 * 500, and an unbounded array lets a single request rewrite the entire
 * collection — so both are checked here before anything touches the database.
 *
 * @param {*} value raw `payrollIds` from the body
 * @returns {{ ok: true, ids: string[] } | { ok: false, message: string }}
 */
function parsePayrollIdBatch(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      ok: false,
      message: 'payrollIds must be a non-empty array of payroll record ids',
    };
  }

  if (value.length > MAX_BATCH_SIZE) {
    return {
      ok: false,
      message: `Cannot process more than ${MAX_BATCH_SIZE} payroll records in a single request`,
    };
  }

  const invalid = value.filter((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalid.length > 0) {
    return {
      ok: false,
      message: `Invalid payroll id format: ${invalid.slice(0, 5).join(', ')}`,
    };
  }

  // De-duplicate so a repeated id in the payload cannot be counted twice in the
  // response tallies.
  return { ok: true, ids: [...new Set(value.map(String))] };
}

/**
 * Split a field map into the `$set` and `$unset` halves of an update.
 *
 * `approvePayroll` clears the rejection trail by passing `rejectionReason:
 * undefined`, and `rejectPayroll` clears the approval trail the same way. That
 * only ever worked by accident: mongoose strips `undefined` values out of a
 * `$set`, so those keys were dropped and the stale verdict stayed on the
 * document — a row approved after a rejection kept showing the old reason.
 *
 * Anything explicitly cleared belongs in `$unset` instead, which is what the
 * callers meant.
 *
 * @param {object} fields
 * @returns {{ set: object, unset: object }}
 */
function splitFieldUpdates(fields = {}) {
  const set = {};
  const unset = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      unset[key] = '';
    } else {
      set[key] = value;
    }
  }

  return { set, unset };
}

/**
 * Apply a status transition to a batch of payroll records owned by the caller.
 *
 * This is the whole fix for the cross-tenant hole in #458 concentrated in one
 * place: the query is *always* scoped by `tenantId`, and every id is
 * classified so the response can tell the client precisely which records moved,
 * which were not theirs, and which were in a state the transition table
 * forbids. The previous implementation issued a blind `updateMany` keyed only
 * on `_id`, which both leaked other companies' records and reported success for
 * ids that matched nothing.
 *
 * @param {object} params
 * @param {string} params.tenantId caller's company — the ownership scope
 * @param {string[]} params.ids payroll ids to transition
 * @param {string} params.targetStatus a PAYROLL_STATUS value
 * @param {object} params.extraFields fields to write alongside the status; a
 *   key whose value is `undefined` or `null` is removed from the document
 *   rather than written, see `splitFieldUpdates`
 * @returns {Promise<{applied: object[], notFound: string[], invalidTransition: object[]}>}
 */
async function transitionPayrollBatch({
  tenantId,
  ids,
  targetStatus,
  extraFields = {},
}) {
  // Scoped read first. Anything the caller does not own simply never appears in
  // this result set, and therefore lands in `notFound` — the caller cannot tell
  // "does not exist" from "belongs to someone else", which is the correct
  // answer to give.
  const owned = await PayrollUpdate.find({
    _id: { $in: ids },
    tenantId,
  }).select('_id status employeeName month year netSalary __v');

  const ownedById = new Map(owned.map((p) => [String(p._id), p]));

  const notFound = ids.filter((id) => !ownedById.has(String(id)));
  const transitionable = [];
  const invalidTransition = [];

  for (const record of owned) {
    const current = normalizeStatus(record.status) || record.status;

    if (!canTransition(current, targetStatus)) {
      invalidTransition.push({
        payrollId: String(record._id),
        employeeName: record.employeeName,
        currentStatus: current,
        reason: describeTransition(current, targetStatus),
      });
      continue;
    }

    transitionable.push(record);
  }

  let applied = [];
  const versionConflicts = [];

  if (transitionable.length > 0) {
    const targetIds = transitionable.map((r) => r._id);

    const { set, unset } = splitFieldUpdates(extraFields);
    const update = {
      $set: { status: targetStatus, ...set },
      $inc: { __v: 1 },
    };
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const filter = {
      _id: { $in: targetIds },
      tenantId,
      $or: transitionable.map((r) => ({ _id: r._id, __v: r.__v })),
    };

    const res = await PayrollUpdate.updateMany(filter, update, {
      runValidators: true,
    });

    const matched =
      res.matchedCount !== undefined ? res.matchedCount : res.modifiedCount;

    if (matched < transitionable.length) {
      transitionable.forEach((r) => {
        versionConflicts.push({
          payrollId: String(r._id),
          employeeName: r.employeeName,
        });
      });
    } else {
      applied = transitionable.map((r) => ({
        payrollId: String(r._id),
        employeeName: r.employeeName,
        month: r.month,
        year: r.year,
        netSalary: r.netSalary,
        previousStatus: normalizeStatus(r.status) || r.status,
        status: targetStatus,
      }));
    }
  }

  return { applied, notFound, invalidTransition, versionConflicts };
}

// FINALIZE PAYROLL — process activity entries and save payroll records

/**
 * GET /api/payroll/approvals — the checker's queue.
 *
 * The original implementation ran `PayrollUpdate.find({ status:
 * "PENDING_APPROVAL" })` with the comment "Admin sees all in this demo". On a
 * shared deployment that returns every company's employee names, base salaries
 * and net salaries to any logged-in account. Scoped by `tenantId` like every
 * other read in the codebase (#458).
 */
exports.getPendingApprovals = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) limit = 20;

    const skip = (page - 1) * limit;

    const query = {
      tenantId: req.tenantId,
      status: PAYROLL_STATUS.PENDING_APPROVAL,
    };

    // Optional period narrowing, so a checker can review one month at a time
    // rather than paging through the entire backlog.
    if (req.query.month !== undefined) {
      const month = Number(req.query.month);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: 'Invalid month parameter' });
      }
      query.month = month;
    }

    if (req.query.year !== undefined) {
      const year = Number(req.query.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ message: 'Invalid year parameter' });
      }
      query.year = year;
    }

    const [pending, totalCount] = await Promise.all([
      PayrollUpdate.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('submittedBy', 'fullName email')
        .populate('employeeId', 'fullName role email'),
      PayrollUpdate.countDocuments(query),
    ]);

    // The checker needs the size of what they are signing off, not just the
    // page in front of them.
    const [totals] = await PayrollUpdate.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalNetSalary: { $sum: '$netSalary' },
          employeeCount: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      pending,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 0,
      totalCount,
      pendingTotalNetSalary: totals
        ? Math.round(totals.totalNetSalary * 100) / 100
        : 0,
      pendingEmployeeCount: totals ? totals.employeeCount : 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payroll/approve — checker signs off a batch.
 *
 * Previously an unscoped `updateMany` keyed on `_id` alone: any authenticated
 * account could approve any other company's payroll by guessing or harvesting
 * ids, and the handler reported success regardless of whether anything matched.
 */
exports.approvePayroll = async (req, res, next) => {
  try {
    const batch = parsePayrollIdBatch(req.body && req.body.payrollIds);
    if (!batch.ok) {
      return res.status(400).json({ message: batch.message });
    }

    const approvedAt = new Date();

    const { applied, notFound, invalidTransition, versionConflicts } =
      await transitionPayrollBatch({
        tenantId: req.tenantId,
        ids: batch.ids,
        targetStatus: PAYROLL_STATUS.APPROVED,
        extraFields: {
          approvedBy: req.userId,
          approvedAt,
          // Clear any prior rejection so a resubmitted-then-approved row does not
          // keep showing a stale reason on the payslip screen.
          rejectionReason: undefined,
          rejectedBy: undefined,
          rejectedAt: undefined,
        },
      });

    if (versionConflicts && versionConflicts.length > 0) {
      return res.status(409).json({
        message:
          'A concurrent update was detected. Please reload and try again.',
        versionConflicts,
      });
    }

    if (applied.length === 0) {
      // Nothing moved. A 409 rather than a 200 so the UI does not tell the user
      // an approval happened when it did not.
      return res.status(409).json({
        message: 'No payroll records were approved',
        approvedCount: 0,
        notFound,
        invalidTransition,
      });
    }

    // Approved rows enter every payable total, so the cached analytics are now
    // stale — the same invalidation contract the finalize path follows (#415).
    // Invalidate analytics and dashboard caches since financial data changed (Issue #519)
    await cacheService.invalidateAnalytics(req.userId);
    await cacheService.invalidateDashboardSummary(req.userId);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYROLL_APPROVE',
      resourceType: 'Payroll',
      resourceIds: applied.map((a) => a.payrollId),
      details: {
        approvedCount: applied.length,
        notFoundCount: notFound.length,
        invalidTransitionCount: invalidTransition.length,
        totalNetSalary: applied.reduce((sum, a) => sum + (a.netSalary || 0), 0),
      },
      result:
        notFound.length > 0 || invalidTransition.length > 0
          ? 'partial'
          : 'success',
      req,
    });

    logger.info('Payroll approved', {
      userId: req.userId,
      approvedCount: applied.length,
      notFoundCount: notFound.length,
      invalidTransitionCount: invalidTransition.length,
    });

    res.status(200).json({
      message: `Approved ${applied.length} payroll record${applied.length !== 1 ? 's' : ''}`,
      approvedCount: applied.length,
      approved: applied,
      notFound,
      invalidTransition,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payroll/reject — checker sends a batch back to the maker.
 *
 * Same ownership fix as approve, plus the rejection reason is now actually
 * persisted: `rejectionReason` was not on the schema, so mongoose strict mode
 * discarded it and the maker was told "rejected" with no indication why (#458).
 */
exports.rejectPayroll = async (req, res, next) => {
  try {
    const batch = parsePayrollIdBatch(req.body && req.body.payrollIds);
    if (!batch.ok) {
      return res.status(400).json({ message: batch.message });
    }

    const rawReason = req.body && req.body.reason;
    if (typeof rawReason !== 'string' || rawReason.trim() === '') {
      return res
        .status(400)
        .json({ message: 'A rejection reason is required' });
    }

    const reason = rawReason.trim().slice(0, MAX_REJECTION_REASON_LENGTH);
    const rejectedAt = new Date();

    const { applied, notFound, invalidTransition, versionConflicts } =
      await transitionPayrollBatch({
        tenantId: req.tenantId,
        ids: batch.ids,
        targetStatus: PAYROLL_STATUS.REJECTED,
        extraFields: {
          rejectionReason: reason,
          rejectedBy: req.userId,
          rejectedAt,
          approvedBy: undefined,
          approvedAt: undefined,
        },
      });

    if (versionConflicts && versionConflicts.length > 0) {
      return res.status(409).json({
        message:
          'A concurrent update was detected. Please reload and try again.',
        versionConflicts,
      });
    }

    if (applied.length === 0) {
      return res.status(409).json({
        message: 'No payroll records were rejected',
        rejectedCount: 0,
        notFound,
        invalidTransition,
      });
    }

    // Invalidate analytics and dashboard caches since financial data changed (Issue #519)
    await cacheService.invalidateAnalytics(req.userId);
    await cacheService.invalidateDashboardSummary(req.userId);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYROLL_REJECT',
      resourceType: 'Payroll',
      resourceIds: applied.map((a) => a.payrollId),
      details: {
        rejectedCount: applied.length,
        notFoundCount: notFound.length,
        invalidTransitionCount: invalidTransition.length,
        reason,
      },
      result:
        notFound.length > 0 || invalidTransition.length > 0
          ? 'partial'
          : 'success',
      req,
    });

    logger.info('Payroll rejected', {
      userId: req.userId,
      rejectedCount: applied.length,
      notFoundCount: notFound.length,
    });

    res.status(200).json({
      message: `Rejected ${applied.length} payroll record${applied.length !== 1 ? 's' : ''}`,
      rejectedCount: applied.length,
      rejected: applied,
      notFound,
      invalidTransition,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payroll/mark-paid — record disbursement.
 *
 * The lifecycle had no way to reach `paid` at all: `submitPayrollForReview`
 * writes `pending_approval`, approve writes `approved`, and nothing ever moved
 * a record on from there — yet `deleteEmployee` (#345) and the re-finalise
 * guard (#251) both key off `paid`. Without this endpoint those protections
 * could never trigger.
 */
exports.markPayrollPaid = async (req, res, next) => {
  try {
    const batch = parsePayrollIdBatch(req.body && req.body.payrollIds);
    if (!batch.ok) {
      return res.status(400).json({ message: batch.message });
    }

    const paidAt = new Date();

    const { applied, notFound, invalidTransition, versionConflicts } =
      await transitionPayrollBatch({
        tenantId: req.tenantId,
        ids: batch.ids,
        targetStatus: PAYROLL_STATUS.PAID,
        extraFields: { paidAt },
      });

    if (versionConflicts && versionConflicts.length > 0) {
      return res.status(409).json({
        message:
          'A concurrent update was detected. Please reload and try again.',
        versionConflicts,
      });
    }

    if (applied.length === 0) {
      return res.status(409).json({
        message: 'No payroll records were marked as paid',
        paidCount: 0,
        notFound,
        invalidTransition,
      });
    }

    // Invalidate analytics and dashboard caches since financial data changed (Issue #519)
    await cacheService.invalidateAnalytics(req.userId);
    await cacheService.invalidateDashboardSummary(req.userId);

    logger.info('Payroll marked paid', {
      userId: req.userId,
      paidCount: applied.length,
    });

    res.status(200).json({
      message: `Marked ${applied.length} payroll record${applied.length !== 1 ? 's' : ''} as paid`,
      paidCount: applied.length,
      paid: applied,
      notFound,
      invalidTransition,
    });
  } catch (error) {
    next(error);
  }
};

exports.parsePayrollCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded.' });
    }

    const csvData = req.file.buffer.toString('utf8');
    const lines = csvData.split('\n');
    if (lines.length < 2) {
      return res
        .status(400)
        .json({ message: 'CSV file is empty or missing headers.' });
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const empIdIdx = headers.findIndex(
      (h) => h.includes('employee id') || h === 'id',
    );
    const nameIdx = headers.findIndex(
      (h) => h.includes('name') || h === 'employee name',
    );
    const otIdx = headers.findIndex((h) => h.includes('overtime'));
    const bonusIdx = headers.findIndex((h) => h.includes('bonus'));
    const leaveIdx = headers.findIndex((h) => h.includes('leave'));

    const employees = await Employee.find({
      tenantId: req.tenantId,
      isDeleted: { $ne: true }, // Filter soft-deleted - Issue #526
    });
    const activities = [];
    // `require('uuid')` threw MODULE_NOT_FOUND — uuid is not a dependency of
    // this package — and because the throw happens while evaluating the left
    // operand, the `|| fallback` could never run. Every call to this endpoint
    // was a guaranteed 500 on a clean install. `crypto.randomUUID` is in the
    // Node standard library and needs no dependency at all (#458).
    const v4 = () => crypto.randomUUID();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Basic CSV split, ignores quotes (assuming simple format for ECSoC)
      const cols = line.split(',').map((c) => c.trim());

      const empIdStr = empIdIdx >= 0 ? cols[empIdIdx] : null;
      const nameStr = nameIdx >= 0 ? cols[nameIdx] : null;

      let matchedEmp = null;
      if (empIdStr) {
        matchedEmp = employees.find((e) => String(e._id) === empIdStr);
      }
      if (!matchedEmp && nameStr) {
        matchedEmp = employees.find(
          (e) => e.fullName.toLowerCase() === nameStr.toLowerCase(),
        );
      }

      if (!matchedEmp) continue; // Skip unmatchable employees

      const tags = [];
      if (otIdx >= 0 && cols[otIdx] && Number(cols[otIdx]) > 0) {
        tags.push({
          label: `+ ${cols[otIdx]} hr overtime`,
          bg: '#EFF6FF',
          color: '#2563EB',
        });
      }
      if (bonusIdx >= 0 && cols[bonusIdx] && Number(cols[bonusIdx]) > 0) {
        tags.push({
          label: `+ ₹${cols[bonusIdx]} bonus`,
          bg: '#F0FDF4',
          color: '#16A34A',
        });
      }
      if (leaveIdx >= 0 && cols[leaveIdx] && Number(cols[leaveIdx]) > 0) {
        const val = Number(cols[leaveIdx]);
        tags.push({
          label: `– ${val} day${val > 1 ? 's' : ''} leave`,
          bg: '#FEF2F2',
          color: '#DC2626',
        });
      }

      if (tags.length > 0) {
        activities.push({
          id: v4(),
          employeeId: matchedEmp._id,
          name: matchedEmp.fullName,
          tags,
          note: 'Imported via CSV',
          pending: true,
          rawInput: line,
        });
      }
    }

    res.status(200).json({
      message: 'CSV parsed successfully',
      activities,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payroll/fx-rates
 * Fetch multi-currency FX rates and supported currencies.
 */
exports.getExchangeRates = async (req, res, next) => {
  try {
    const baseCurrency = req.query.baseCurrency || 'USD';
    const fxData = await FXService.getRatesForBase(baseCurrency);
    return res.status(200).json({
      success: true,
      ...fxData,
    });
  } catch (error) {
    next(error);
  }
};


exports.submitPayrollForReview = async (req, res, next) => {
  let session = null;
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Request body is required' });
    }
    const { activities, month, year } = req.body;

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ message: 'No activities to process' });
    }

    let currentMonth =
      month !== undefined ? Number(month) : new Date().getMonth() + 1;
    let currentYear =
      year !== undefined ? Number(year) : new Date().getFullYear();

    if (
      isNaN(currentMonth) ||
      !Number.isInteger(currentMonth) ||
      currentMonth < 1 ||
      currentMonth > 12
    ) {
      return res
        .status(400)
        .json({
          message: 'Invalid month. Must be an integer between 1 and 12',
        });
    }

    if (
      isNaN(currentYear) ||
      !Number.isInteger(currentYear) ||
      currentYear < 2000 ||
      currentYear > 2100
    ) {
      return res
        .status(400)
        .json({ message: 'Invalid year. Must be a valid year integer' });
    }

    // Fetch all employees for this user
    const employees = await Employee.find({
      tenantId: req.tenantId,
      isDeleted: { $ne: true }, // Filter soft-deleted - Issue #526
    });

    if (employees.length === 0) {
      return res
        .status(400)
        .json({ message: 'No employees found. Add employees first.' });
    }

    // Fetch user settings for default rates
    const user = await User.findById(req.userId);

    // Three ledgers are loaded up front, and they sit at different points of
    // the salary calculation: attendance supplies its *inputs* (leaveDays,
    // overtimeHours), loan recovery is taken out of its *output* and is
    // therefore capped by what the employee can actually afford, and the
    // salary structure describes how the gross it works from is split.
    // None of them is a prerequisite for paying people — each degrades loudly
    // rather than failing the run.

    // Where a month has been recorded, its validated totals are a better
    // source for leaveDays/overtimeHours than re-parsing the display strings
    // the client sends — see the comment on the resolver below (#459).
    let attendanceByEmployee = new Map();

    try {
      const attendanceRecords = await Attendance.find({
        tenantId: req.tenantId,
        year: currentYear,
        month: currentMonth,
      }).select('employeeId totals');

      attendanceByEmployee = new Map(
        (attendanceRecords || []).map((record) => [
          String(record.employeeId),
          record,
        ]),
      );
    } catch (attendanceError) {
      logger.warn(
        'Could not read the attendance ledger; falling back to activity tags',
        {
          userId: req.userId,
          month: currentMonth,
          year: currentYear,
          error: attendanceError.message,
        },
      );
    }

    // Every collectible loan for the run, grouped by employee (#460).
    let loansByEmployee = new Map();

    try {
      const activeLoans = await Loan.find({
        tenantId: req.tenantId,
        status: LOAN_STATUS.ACTIVE,
      });

      (activeLoans || []).forEach((loan) => {
        const key = String(loan.employeeId);
        if (!loansByEmployee.has(key)) loansByEmployee.set(key, []);
        loansByEmployee.get(key).push(loan);
      });
    } catch (loanError) {
      // A loan-ledger failure must not stop people being paid. Skipping
      // recovery under-collects for one month, which is recoverable; failing
      // the run is not.
      logger.warn(
        'Could not read the loan ledger; skipping recovery this run',
        {
          userId: req.userId,
          error: loanError.message,
        },
      );
      loansByEmployee = new Map();
    }

    // Every salary revision for the run, grouped by employee, so the row can
    // snapshot the component breakdown that was actually in force. Without the
    // snapshot, regenerating a payslip after a later raise would show the new
    // split against the old total (#461).
    let revisionsByEmployee = new Map();

    try {
      const revisions = await SalaryStructure.find({
        tenantId: req.tenantId,
      }).sort({ effectiveFrom: 1 });

      (revisions || []).forEach((revision) => {
        const key = String(revision.employeeId);
        if (!revisionsByEmployee.has(key)) revisionsByEmployee.set(key, []);
        revisionsByEmployee.get(key).push(revision);
      });
    } catch (structureError) {
      // The breakdown is presentational; the gross on the employee record is
      // still authoritative.
      logger.warn(
        'Could not read salary structures; payroll will run without a breakdown',
        {
          userId: req.userId,
          error: structureError.message,
        },
      );
      revisionsByEmployee = new Map();
    }

    const preparedItems = [];
    const errors = [];

    // Approved expense claims this run should pay out (#719).
    //
    // Bounded by the *end* of the period and not by its start, which is the
    // difference between "this month's receipts" and "everything approved and
    // still owed". #719's own acceptance criteria ask for the latter: a receipt
    // dated 20 August that a manager only approves on 3 September was never in
    // scope again under the old filter — August had closed and September only
    // looked at September-dated receipts — so the claim was stranded for good
    // (#794).
    //
    // `payrollId: null` still does the double-payment prevention, and it is the
    // condition that makes widening the date window safe: a claim leaves this
    // set the moment a run pays it.
    const ExpenseClaim = require('../models/expenseClaim.model');
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const pendingExpenses = await ExpenseClaim.find({
      tenantId: req.tenantId,
      status: 'approved',
      payrollId: null, // Unreimbursed
      expenseDate: { $lte: monthEnd },
    })
      .populate('categoryId', 'isTaxable name')
      .lean();

    // Group expenses by employee ID for fast lookup
    const expensesByEmployee = new Map();
    for (const exp of pendingExpenses) {
      // `populate` yields null for a reference that no longer resolves, and a
      // deactivated-then-deleted category is not far-fetched. Reading
      // `.isTaxable` off it threw a TypeError here — before any writes, in the
      // middle of the prepare loop — so one dangling reference failed payroll
      // for the entire tenant rather than for the one claim.
      if (!exp.categoryId) {
        errors.push(
          `Expense claim ${exp._id} was skipped: its category no longer exists`,
        );
        continue;
      }

      const amount = Number(exp.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push(
          `Expense claim ${exp._id} was skipped: the amount is not a usable number`,
        );
        continue;
      }

      const key = String(exp.employeeId);
      if (!expensesByEmployee.has(key)) {
        expensesByEmployee.set(key, { taxable: 0, nonTaxable: 0, ids: [] });
      }
      const bucket = expensesByEmployee.get(key);
      if (exp.categoryId.isTaxable) {
        bucket.taxable += amount;
      } else {
        bucket.nonTaxable += amount;
      }
      bucket.ids.push(exp._id);
    }

    // Phase 1: Upfront in-memory calculation and validation (no partial writes)
    for (const act of activities) {
      if (!act || typeof act !== 'object') {
        errors.push('Invalid activity entry format');
        continue;
      }

      let employeeId = act.employeeId;
      if (!employeeId && act.name) {
        const matchedEmp = employees.find(
          (emp) => emp.fullName.toLowerCase() === act.name.toLowerCase(),
        );
        if (matchedEmp) {
          employeeId = matchedEmp._id;
        }
      }

      if (!employeeId) {
        errors.push(
          `employeeId is required but missing for activity involving "${act.name || 'unnamed'}"`,
        );
        continue;
      }

      const employee = employees.find(
        (emp) => String(emp._id) === String(employeeId),
      );

      if (!employee) {
        errors.push(`Could not find employee with ID: ${employeeId}`);
        continue;
      }

      // An employee serving notice is still working and still payable up to
      // their last day — excluding them the moment they resign is exactly what
      // made the final month unpayable before #462. Only an *exited* employee
      // drops out.
      if (employee.employmentStatus === 'exited') {
        errors.push(
          `Employee ${employee.fullName} has exited and cannot be included in payroll`,
        );
        continue;
      }

      if (!employee.isActive) {
        errors.push(
          `Employee ${employee.fullName} is inactive and cannot be included in payroll`,
        );
        continue;
      }

      let leaveDays = 0,
        overtimeHours = 0,
        bonus = 0,
        deductions = 0;

      const tagsList = Array.isArray(act.tags) ? act.tags : [];
      for (const tag of tagsList) {
        if (!tag || typeof tag.label !== 'string') continue;
        const lower = tag.label.toLowerCase();
        const value = parseTagValue(tag.label);

        if (lower.includes('overtime') || lower.includes('ot')) {
          overtimeHours += value;
        } else if (lower.includes('bonus')) {
          bonus += value;
        } else if (lower.includes('deduct')) {
          deductions += value;
        } else if (
          lower.includes('leave') ||
          lower.includes('unpaid') ||
          lower.includes('absence')
        ) {
          leaveDays += value;
        } else if (lower.includes('day')) {
          leaveDays += value;
        } else if (lower.includes('hr') || lower.includes('hour')) {
          overtimeHours += value;
        }
      }

      leaveDays =
        isNaN(leaveDays) || !Number.isFinite(leaveDays) || leaveDays < 0
          ? 0
          : leaveDays;
      overtimeHours =
        isNaN(overtimeHours) ||
        !Number.isFinite(overtimeHours) ||
        overtimeHours < 0
          ? 0
          : overtimeHours;
      bonus = isNaN(bonus) || !Number.isFinite(bonus) || bonus < 0 ? 0 : bonus;
      deductions =
        isNaN(deductions) || !Number.isFinite(deductions) || deductions < 0
          ? 0
          : deductions;

      // Prefer the persisted ledger over the parsed tag strings.
      //
      // The tag path reaches these numbers by stripping non-digits out of a
      // label like "– 3 days leave" and disambiguating with substring matching,
      // so "2 days unpaid leave (overtime adjusted)" hits the `includes("overtime")`
      // branch first and is booked as overtime hours. It also cannot represent
      // a half day and cannot tell paid leave from unpaid.
      //
      // The ledger has none of those problems: it was validated at write time,
      // half days contribute 0.5, and only *unpaid* absence reaches leaveDays.
      // Bonus and deductions still come from the tags — they are ad-hoc
      // monetary adjustments with no attendance equivalent.
      let attendanceSource = 'manual';
      const ledger = attendanceByEmployee.get(String(employee._id));

      if (ledger && ledger.totals) {
        const derived = derivePayrollInputs(ledger.totals);
        leaveDays = derived.leaveDays;
        overtimeHours = derived.overtimeHours;
        attendanceSource = 'ledger';
      }

      // Approved expense claims waiting on this run (#719), resolved before the
      // salary is calculated rather than after it.
      //
      // A taxable claim used to be added to `bonus` *below*, after
      // `calculateNetSalary` had already run on the original figure — so the
      // stored `bonus` column went up, `netSalary` did not move at all, and the
      // claim was still stamped `reimbursed` at the end of the run. The employee
      // was left out of pocket with a payslip saying they had been paid, and the
      // claim could never be picked up again because its `payrollId` was set
      // (#794).
      const empExpenses = expensesByEmployee.get(String(employee._id)) || {
        taxable: 0,
        nonTaxable: 0,
        ids: [],
      };

      // Taxable claims are earnings: they go in with the bonus, before tax and
      // before loan recovery, exactly as #719 intended.
      const bonusWithTaxableExpenses =
        Math.round((bonus + empExpenses.taxable) * 100) / 100;

      const { baseSalary, leaveDeduction, overtimePay, netSalary } =
        calculateNetSalary(employee, user, {
          leaveDays,
          overtimeHours,
          bonus: bonusWithTaxableExpenses,
          deductions,
        });

      if (isNaN(netSalary) || !Number.isFinite(netSalary)) {
        errors.push(
          `Invalid net salary calculation for employee "${employee.fullName}"`,
        );
        continue;
      }

      // Snapshot the component split in force for this period. A mid-month
      // revision produces more than one segment, and `effectiveGross` is the
      // day-weighted blend of the rates that actually applied.
      let salarySnapshot = null;

      try {
        const employeeRevisions =
          revisionsByEmployee.get(String(employee._id)) || [];

        if (employeeRevisions.length > 0) {
          const period = resolveStructureForPeriod(
            employeeRevisions,
            currentMonth,
            currentYear,
          );

          if (period.segments.length > 0) {
            const primary =
              period.segments[period.segments.length - 1].structure;
            const breakdown = computeComponentAmounts(primary);

            salarySnapshot = {
              effectiveGross: period.effectiveGross,
              isProrated: period.segments.length > 1,
              segmentCount: period.segments.length,
              components: breakdown.components.map((c) => ({
                code: c.code,
                label: c.label,
                type: c.type,
                amount: c.amount,
              })),
            };
          }
        }
      } catch (snapshotError) {
        logger.warn(
          'Could not snapshot the salary breakdown for a payroll row',
          {
            userId: req.userId,
            employeeId: String(employee._id),
            error: snapshotError.message,
          },
        );
      }

      // Loan recovery, capped at the net salary so a deduction can never drive
      // take-home pay below zero. Any uncollected part is a shortfall carried
      // forward — the loan is not forgiven, this month's instalment simply is
      // not taken and the outstanding balance stays where it was (#460).
      const employeeLoans = loansByEmployee.get(String(employee._id)) || [];
      const recovery = allocateRecovery({
        loans: employeeLoans,
        month: currentMonth,
        year: currentYear,
        availableForRecovery: netSalary,
      });

      const netAfterRecovery = Math.max(
        0,
        Math.round((netSalary - recovery.totalRecovered) * 100) / 100,
      );

      if (recovery.shortfall > 0) {
        errors.push(
          `Loan recovery for "${employee.fullName}" was short by ${recovery.shortfall}; the balance carries forward`,
        );
      }

      // A tax-free reimbursement is not earnings — it is the employee being made
      // whole for money they already spent — so it lands after tax and after
      // loan recovery. Recovering a loan instalment out of somebody's train
      // fare would be taking the same money twice.
      const finalNetSalary =
        Math.round((netAfterRecovery + empExpenses.nonTaxable) * 100) / 100;

      preparedItems.push({
        employee,
        baseSalary,
        leaveDays,
        overtimeHours,
        bonus: bonusWithTaxableExpenses,
        deductions,
        leaveDeduction,
        overtimePay,
        reimbursements: empExpenses.nonTaxable,
        reimbursedExpenseIds: empExpenses.ids,
        netSalary: finalNetSalary,
        grossNetBeforeRecovery: netSalary,
        loanRecoveries: recovery.recoveries,
        loanRecoveryTotal: recovery.totalRecovered,
        attendanceSource,
        salarySnapshot,
      });
    }

    if (preparedItems.length === 0) {
      return res.status(400).json({
        message: 'No valid employee activities to process',
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // Guard: prevent overwriting already-paid payroll records (#251) and, now
    // that a checker exists, already-approved ones too.
    //
    // The bulkWrite below upserts with `$set: { status: pending_approval }`, so
    // without this guard a maker could re-run payroll on an approved row and
    // silently walk it back to pending with new figures *after* sign-off —
    // which is precisely the abuse a maker–checker flow exists to prevent. The
    // transition table already declares `approved -> pending_approval` illegal;
    // this enforces it on the write path (#458).
    const employeeIds = preparedItems.map((item) => item.employee._id);
    const lockedRecords = await PayrollUpdate.find({
      employeeId: { $in: employeeIds },
      month: currentMonth,
      year: currentYear,
      createdBy: req.userId,
      tenantId: req.tenantId,
      status: {
        $in: [PAYROLL_STATUS.PAID, PAYROLL_STATUS.APPROVED, 'finalized'],
      },
    });

    // #543 pasted a `payroll.paid` webhook trigger in here, in the middle of
    // `submitPayrollForReview`, referring to four names that do not exist in
    // this scope — `status`, `payroll`, and a `webhookService.triggerEvent` that
    // the webhook service has never exported. The first one it reached threw:
    //
    //     ReferenceError: status is not defined
    //
    // on *every* payroll submission, before a single row was written. Removed
    // rather than repaired, for two reasons. This function only ever produces
    // rows in `pending_approval`, so a "paid" event fired from here would be
    // false by construction. And payroll webhooks already have a delivery path:
    // services/webhook.service.js subscribes to AUDIT_LOG and maps
    // PAYROLL_FINALIZE / PAYROLL_APPROVE / PAYROLL_PAID onto endpoints (#474),
    // which is where a genuine payment event belongs.

    if (lockedRecords.length > 0) {
      const paidEmployees = lockedRecords
        .filter((p) => normalizeStatus(p.status) === PAYROLL_STATUS.PAID)
        .map((p) => p.employeeName);
      const approvedEmployees = lockedRecords
        .filter((p) => normalizeStatus(p.status) === PAYROLL_STATUS.APPROVED)
        .map((p) => p.employeeName);

      const parts = [];
      if (paidEmployees.length > 0) {
        parts.push(`already paid for: ${paidEmployees.join(', ')}`);
      }
      if (approvedEmployees.length > 0) {
        parts.push(
          `already approved for: ${approvedEmployees.join(', ')} (reject the run first to re-submit)`,
        );
      }

      return res.status(409).json({
        message: `Payroll is ${parts.join('; ')}.`,
        paidEmployees,
        approvedEmployees,
        lockedEmployees: lockedRecords.map((p) => p.employeeName),
      });
    }

    // Try starting a session for transaction atomicity
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    // Phase 2: Write all calculated records atomically within transaction using bulkWrite
    const bulkOps = preparedItems.map((item) => {
      const payrollData = {
        employeeId: item.employee._id,
        employeeName: item.employee.fullName,
        currency: item.employee.currency || 'INR',
        month: currentMonth,
        year: currentYear,
        baseSalary: item.baseSalary,
        overtimeRate: item.employee.overtimeRate || 0,
        leaveDays: item.leaveDays,
        overtimeHours: item.overtimeHours,
        bonus: item.bonus,
        deductions: item.deductions,
        leaveDeduction: item.leaveDeduction,
        overtimePay: item.overtimePay,
        netSalary: item.netSalary,
        loanRecoveries: item.loanRecoveries,
        loanRecoveryTotal: item.loanRecoveryTotal,
        // #719 declared both of these on the schema and worked both of them out
        // in the prepare loop above, and then never wrote either. So the
        // reimbursement column was 0 on every row on disk, the payslip had
        // nothing to render a "Reimbursements" line from, and the audit trail
        // linking a run to the claims it paid ran in one direction only (#794).
        reimbursements: item.reimbursements,
        reimbursedExpenseIds: item.reimbursedExpenseIds,
        // Recorded so a later audit can tell whether the leave figure came
        // from the validated ledger or from a parsed display string (#459).
        attendanceSource: item.attendanceSource,
        salarySnapshot: item.salarySnapshot,
        tenantId: req.tenantId,
        status: PAYROLL_STATUS.PENDING_APPROVAL,
        submittedBy: req.userId,
        submittedAt: new Date(),
        // A resubmission after a rejection must not carry the old verdict
        // forward, or the checker sees a row that is simultaneously pending and
        // rejected.
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      };

      return {
        updateOne: {
          filter: {
            employeeId: item.employee._id,
            month: currentMonth,
            year: currentYear,
            tenantId: req.tenantId,
          },
          update: { $set: payrollData },
          upsert: true,
        },
      };
    });

    const bulkWriteOptions = session ? { session } : {};
    await PayrollUpdate.bulkWrite(bulkOps, bulkWriteOptions);

    // Issue #719: Mark expense claims as reimbursed and link to payroll
    const allReimbursedIds = preparedItems.flatMap(
      (item) => item.reimbursedExpenseIds || [],
    );
    if (allReimbursedIds.length > 0) {
      // We need the actual payroll IDs to link them. Fetch them first.
      // Read inside the transaction. The bulkWrite above upserts these rows, so
      // without the session this find runs outside it and cannot see them —
      // `payrollId` would come back undefined for every newly created row and
      // the link back from the claim would be written empty (#794).
      const updatedPayrollsForExpenses = await PayrollUpdate.find({
        tenantId: req.tenantId,
        month: currentMonth,
        year: currentYear,
        employeeId: { $in: preparedItems.map((i) => i.employee._id) },
      })
        .setOptions(bulkWriteOptions)
        .select('_id employeeId')
        .lean();

      const payrollMap = new Map(
        updatedPayrollsForExpenses.map((p) => [String(p.employeeId), p._id]),
      );

      const expenseUpdates = preparedItems.flatMap((item) => {
        const payrollId = payrollMap.get(String(item.employee._id));

        // No payroll row means nothing paid this claim, so leaving it
        // unreimbursed is the honest outcome — marking it `reimbursed` with a
        // null payrollId would retire the claim without paying it and make it
        // unrecoverable.
        if (!payrollId) return [];

        return (item.reimbursedExpenseIds || []).map((expId) => ({
          updateOne: {
            filter: { _id: expId, tenantId: req.tenantId, payrollId: null },
            update: {
              $set: {
                status: 'reimbursed',
                payrollId,
                reimbursedAt: new Date(),
              },
            },
          },
        }));
      });

      if (expenseUpdates.length > 0) {
        await ExpenseClaim.bulkWrite(expenseUpdates, bulkWriteOptions);
      }
    }

    // Phase 3: Fetch updated payrolls to construct response
    const fetchOptions = session ? { session } : {};
    const updatedPayrolls = await PayrollUpdate.find(
      {
        tenantId: req.tenantId,
        month: currentMonth,
        year: currentYear,
        employeeId: { $in: preparedItems.map((item) => item.employee._id) },
      },
      null,
      fetchOptions,
    );

    const payrollMap = {};
    updatedPayrolls.forEach((p) => {
      payrollMap[p.employeeId.toString()] = p._id;
    });

    const results = preparedItems.map((item) => ({
      employeeName: item.employee.fullName,
      currency: item.employee.currency || 'INR',
      baseSalary: item.baseSalary,
      leaveDays: item.leaveDays,
      leaveDeduction: item.leaveDeduction,
      overtimeHours: item.overtimeHours,
      overtimePay: item.overtimePay,
      bonus: item.bonus,
      deductions: item.deductions,
      netSalary: item.netSalary,
      loanRecoveryTotal: item.loanRecoveryTotal,
      loanRecoveries: item.loanRecoveries,
      attendanceSource: item.attendanceSource,
      payrollId: payrollMap[item.employee._id.toString()],
    }));

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    // Write the loan ledger only after the payroll write has committed.
    //
    // `applyRepayment` replaces the entry for the period rather than appending,
    // so re-finalising a month (which the approval flow explicitly allows for a
    // rejected run) cannot collect the same instalment twice.
    for (const item of preparedItems) {
      for (const entry of item.loanRecoveries || []) {
        if (!entry.loanId || entry.alreadyRecovered) continue;

        try {
          const loan = (
            loansByEmployee.get(String(item.employee._id)) || []
          ).find((l) => String(l._id) === String(entry.loanId));
          if (!loan) continue;

          const applied = applyRepayment(loan, {
            month: currentMonth,
            year: currentYear,
            amount: entry.amount,
            payrollId: payrollMap[item.employee._id.toString()] || null,
          });

          await Loan.updateOne(
            { _id: loan._id, tenantId: req.tenantId },
            {
              $set: {
                repayments: applied.repayments,
                totalRepaid: applied.totalRepaid,
                outstanding: applied.outstanding,
                status: applied.status,
                ...(applied.status === LOAN_STATUS.COMPLETED
                  ? { completedAt: new Date() }
                  : {}),
              },
            },
          );

          eventBus.emit('AUDIT_LOG', {
            userId: req.userId,
            action: 'LOAN_REPAYMENT',
            resourceType: 'Loan',
            resourceIds: [loan._id],
            details: {
              employeeName: item.employee.fullName,
              amount: entry.amount,
              month: currentMonth,
              year: currentYear,
              outstanding: applied.outstanding,
              source: 'payroll',
            },
            req,
          });
        } catch (repayError) {
          // The salary is already committed; a ledger write failure must be
          // loud but must not roll the payroll back.
          logger.error('Failed to record a loan repayment after payroll', {
            userId: req.userId,
            loanId: String(entry.loanId),
            error: repayError.message,
          });
        }
      }
    }

    // Finalizing payroll is the single biggest change to the analytics figures,
    // and it was the one mutation that never cleared the cache — so Reports kept
    // serving pre-run totals for up to an hour afterwards (#415).
    // Invalidate analytics and dashboard caches since financial data changed (Issue #519)
    await cacheService.invalidateAnalytics(req.userId);
    await cacheService.invalidateDashboardSummary(req.userId);

    const resourceIds = results.map((r) => r.payrollId).filter(Boolean);

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYROLL_FINALIZE',
      resourceType: 'Payroll',
      resourceIds,
      details: {
        month: currentMonth,
        year: currentYear,
        employeeCount: results.length,
        totalNetSalary: results.reduce((sum, r) => sum + r.netSalary, 0),
        errorCount: errors.length,
      },
      result: errors.length > 0 ? 'partial' : 'success',
      req,
    });

    logger.info(`Payroll finalized for ${results.length} employees`, {
      userId: req.userId,
      month: currentMonth,
      year: currentYear,
      employeeCount: results.length,
      errorCount: errors.length,
    });

    res.status(200).json({
      message: `Payroll submitted for review for ${results.length} employee${results.length !== 1 ? 's' : ''}`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch {
        // ignore session cleanup error
      }
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYROLL_FINALIZE',
      resourceType: 'Payroll',
      details: {
        month: req.body?.month,
        year: req.body?.year,
        error: error.message,
      },
      result: 'failure',
      req,
    });

    next(error);
  }
};

// GET PAYROLL SUMMARY for a month — with optional pagination
exports.getPayrollSummary = async (req, res, next) => {
  try {
    let month = req.query.month
      ? Number(req.query.month)
      : new Date().getMonth() + 1;
    let year = req.query.year
      ? Number(req.query.year)
      : new Date().getFullYear();

    if (isNaN(month) || !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month parameter' });
    }

    if (isNaN(year) || !Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year parameter' });
    }

    // Scoped by tenant, and refusing to run unscoped: the rest of this handler
    // builds `baseQuery` from `req.tenantId`, and the employee lookup used to
    // disagree with it by filtering on `createdBy: req.userId` — a field #585
    // stopped writing (#665).
    const tenantId = requireTenant(req);

    // `null` means no filter was requested; an empty array means one was and
    // nobody matched. Those are different answers and the old code conflated
    // them, which turned a filter for an empty department into an unfiltered
    // list of the whole month.
    const departments = parseDepartments(req.query.departments);
    const employeeIds = await resolveDepartmentEmployeeIds(
      Employee,
      tenantId,
      departments,
    );

    // Pagination parameters — default to page 1, 20 records per page.
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 0) limit = 20;
    if (limit > 100) limit = 100;

    const skip = limit > 0 ? (page - 1) * limit : 0;

    const baseQuery = {
      tenantId,
      month,
      year,
      ...excludeRejectedFilter(),
    };

    // Was: `{ $in: employeeIds.map(id => require('mongoose').Types.ObjectId(id)) }`.
    // ObjectId is an ES class since Mongoose 6 and this project runs 9.9, so
    // calling it without `new` threw `Class constructor ObjectId cannot be
    // invoked without 'new'` — every request with a department filter was a 500
    // (#665).
    applyEmployeeFilter(baseQuery, employeeIds);

    // Run the count and the paginated page fetch in parallel.
    const [totalCount, payrolls] = await Promise.all([
      PayrollUpdate.countDocuments(baseQuery),
      limit > 0
        ? PayrollUpdate.find(baseQuery)
            .sort({ employeeName: 1 })
            .skip(skip)
            .limit(limit)
        : PayrollUpdate.find(baseQuery).sort({ employeeName: 1 }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1;

    // Aggregate-level totals across the *entire* month (not just the current page)
    const [aggResult] = await PayrollUpdate.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalPayout: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID],
                  ],
                },
                '$netSalary',
                0,
              ],
            },
          },
          payableCount: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$status',
                    [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID],
                  ],
                },
                1,
                0,
              ],
            },
          },
          pendingApprovalTotal: {
            $sum: {
              $cond: [
                { $eq: ['$status', PAYROLL_STATUS.PENDING_APPROVAL] },
                '$netSalary',
                0,
              ],
            },
          },
          pendingApprovalCount: {
            $sum: {
              $cond: [
                { $eq: ['$status', PAYROLL_STATUS.PENDING_APPROVAL] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const round2 = (n) => Math.round(n * 100) / 100;

    res.status(200).json({
      month,
      year,
      totalPayout: round2(aggResult ? aggResult.totalPayout : 0),
      employeeCount: aggResult ? aggResult.payableCount : 0,
      pendingApprovalTotal: round2(
        aggResult ? aggResult.pendingApprovalTotal : 0,
      ),
      pendingApprovalCount: aggResult ? aggResult.pendingApprovalCount : 0,
      payrolls,
      currentPage: page,
      totalPages,
      totalCount,
      departments: departments, // Include filtered departments in response
    });
  } catch (error) {
    next(error);
  }
};

// EXPORT PAYROLL AS CSV
exports.exportPayrollCSV = async (req, res, next) => {
  try {
    const month = req.query.month
      ? parseInt(req.query.month, 10)
      : new Date().getMonth() + 1;
    const year = req.query.year
      ? parseInt(req.query.year, 10)
      : new Date().getFullYear();

    if (isNaN(month) || !Number.isInteger(month) || month < 1 || month > 12) {
      return res
        .status(400)
        .json({
          message:
            'Invalid month parameter. Must be an integer between 1 and 12.',
        });
    }

    if (isNaN(year) || !Number.isInteger(year) || year < 2000 || year > 2100) {
      return res
        .status(400)
        .json({
          message: 'Invalid year parameter. Must be a valid year integer.',
        });
    }

    // An exported payroll register is a financial record — it must contain what
    // was actually approved for payment, not a mixture of approved rows,
    // unreviewed drafts and rows a checker threw out (#458).
    const payrolls = await PayrollUpdate.find({
      tenantId: req.tenantId,
      month,
      year,
      ...payableStatusFilter(),
    }).sort({ employeeName: 1 });

    if (payrolls.length === 0) {
      return res.status(404).json({
        message:
          'No approved payroll data found for the selected month. Approve the run before exporting.',
      });
    }

    const csvData = generatePayrollCSV(payrolls, month, year);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=payroll-${month}-${year}.csv`,
    );
    res.status(200).send(csvData);

    // Salary data leaving the system is an auditable event, consistent with how
    // downloadPDFReport / exportExcelReport already record REPORT_DOWNLOAD (#228).
    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'REPORT_DOWNLOAD',
      resourceType: 'Report',
      details: {
        month,
        year,
        type: 'payroll-csv',
        employeeCount: payrolls.length,
      },
      req,
    });

    logger.info(`Payroll CSV exported`, {
      userId: req.userId,
      month,
      year,
      employeeCount: payrolls.length,
    });
  } catch (error) {
    next(error);
  }
};

const { sendPayslipEmail } = require('../services/email.service');

// SEND PAYSLIP EMAIL manually
exports.sendPayslipEmailHandler = async (req, res, next) => {
  try {
    const payrollId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(payrollId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const payroll = await PayrollUpdate.findOne({
      _id: payrollId,
      tenantId: req.tenantId,
    });

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    const employee = await Employee.findById(payroll.employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Optional: Warn if employee is soft-deleted but still allow sending
    // since this might be for historical payroll records
    if (employee.isDeleted) {
      logger.warn(`Sending payslip email to soft-deleted employee`, {
        userId: req.userId,
        employeeId: employee._id,
        employeeName: employee.fullName,
      });
    }

    if (!employee.email) {
      return res
        .status(400)
        .json({ message: 'Employee does not have an email address set' });
    }

    // Emailing a payslip for a row that has not cleared the checker tells the
    // employee they have been paid a figure nobody signed off on — and for a
    // rejected row, a figure that was explicitly thrown out (#458).
    if (!isEmailable(payroll.status)) {
      return res.status(409).json({
        message: `Cannot email a payslip for a payroll record that is "${normalizeStatus(payroll.status) || payroll.status}". It must be approved first.`,
        status: normalizeStatus(payroll.status) || payroll.status,
      });
    }

    await sendPayslipEmail(employee, payroll);
    await PayrollUpdate.updateOne(
      { _id: payroll._id },
      { payslipEmailed: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYSLIP_EMAIL',
      resourceType: 'Payroll',
      resourceIds: [payroll._id],
      details: {
        employeeName: employee.fullName,
        employeeEmail: employee.email,
        month: payroll.month,
        year: payroll.year,
      },
      req,
    });

    logger.info(`Payslip email sent`, {
      userId: req.userId,
      payrollId: payroll._id,
      employee: employee.fullName,
    });

    res.status(200).json({ message: 'Payslip email sent successfully' });
  } catch (error) {
    next(error);
  }
};

// BULK SEND PAYSLIP EMAILS (#140)
exports.sendAllPayslipsEmailHandler = async (req, res, next) => {
  try {
    let month =
      req.body && req.body.month
        ? Number(req.body.month)
        : req.query.month
          ? Number(req.query.month)
          : new Date().getMonth() + 1;
    let year =
      req.body && req.body.year
        ? Number(req.body.year)
        : req.query.year
          ? Number(req.query.year)
          : new Date().getFullYear();

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month parameter' });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Invalid year parameter' });
    }

    // Same rule as the single-send path: only approved/paid rows are
    // dispatchable. Previously this swept up every unemailed row for the month
    // including pending and rejected ones (#458).
    const payrolls = await PayrollUpdate.find({
      tenantId: req.tenantId,
      month,
      year,
      payslipEmailed: false,
      ...payableStatusFilter(),
    });

    if (payrolls.length === 0) {
      return res.status(404).json({
        message:
          'No approved payroll records awaiting a payslip email for the selected month and year.',
      });
    }

    const employeeIds = [...new Set(payrolls.map((p) => p.employeeId))];
    const employees = await Employee.find({
      _id: { $in: employeeIds },
      isDeleted: { $ne: true }, // Filter soft-deleted - Issue #526
    });
    const employeeMap = new Map(employees.map((e) => [String(e._id), e]));

    const results = [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const payroll of payrolls) {
      const employee = employeeMap.get(String(payroll.employeeId));
      if (!employee) {
        results.push({
          payrollId: payroll._id,
          employeeName: payroll.employeeName,
          status: 'failed',
          error: 'Employee record not found',
        });
        failedCount++;
        continue;
      }

      if (!employee.email) {
        results.push({
          payrollId: payroll._id,
          employeeName: employee.fullName,
          status: 'no_email',
          message: 'No email address registered',
        });
        skippedCount++;
        continue;
      }

      try {
        await sendPayslipEmail(employee, payroll);
        await PayrollUpdate.updateOne(
          { _id: payroll._id },
          { payslipEmailed: true },
        );
        results.push({
          payrollId: payroll._id,
          employeeName: employee.fullName,
          email: employee.email,
          status: 'sent',
        });
        sentCount++;
      } catch (err) {
        logger.error(`Failed to send email to ${employee.fullName}`, {
          error: err.message,
          payrollId: payroll._id,
        });
        results.push({
          payrollId: payroll._id,
          employeeName: employee.fullName,
          email: employee.email,
          status: 'failed',
          error: 'Email delivery failed',
        });
        failedCount++;
      }
    }

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAYSLIP_BULK_EMAIL',
      resourceType: 'Payroll',
      resourceIds: payrolls.map((p) => p._id),
      details: {
        month,
        year,
        sentCount,
        failedCount,
        skippedCount,
        total: payrolls.length,
      },
      result:
        failedCount > 0 ? (sentCount > 0 ? 'partial' : 'failure') : 'success',
      req,
    });

    logger.info(`Bulk payslip email dispatch complete`, {
      userId: req.userId,
      month,
      year,
      sentCount,
      failedCount,
      skippedCount,
      total: payrolls.length,
    });

    res.status(200).json({
      message: `Bulk email dispatch complete. Sent: ${sentCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
      sentCount,
      failedCount,
      skippedCount,
      total: payrolls.length,
      results,
    });
  } catch (error) {
    next(error);
  }
};
