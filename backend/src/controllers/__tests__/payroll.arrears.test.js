/**
 * Payroll <- arrears release (#931, repaired in #950).
 *
 * The property that matters: a payroll run completes. On `main` every call to
 * `submitPayrollForReview` threw `MODULE_NOT_FOUND` on the first employee it
 * processed, because the arrears engine was required from inside the
 * per-employee loop by a path that does not exist. No tenant could run payroll
 * at all, with or without a salary revision anywhere in its history.
 *
 * After that: arrears reach net pay, they are written to columns that exist,
 * and a ledger row is only ever retired against a payroll row that was really
 * created — in the same transaction as the row that pays it.
 */

const mongoose = require('mongoose');

jest.mock('../../models/employee.model');
jest.mock('../../models/user.model');
jest.mock('../../models/loan.model');
jest.mock('../../models/expenseClaim.model');
jest.mock('../../models/arrearsLedger.model');
jest.mock('../../models/payroll.model', () => ({
  find: jest.fn(),
  bulkWrite: jest.fn(),
  updateMany: jest.fn(),
  countDocuments: jest.fn(),
}));

const { submitPayrollForReview } = require('../payroll.controller');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const User = require('../../models/user.model');
const Loan = require('../../models/loan.model');
const ExpenseClaim = require('../../models/expenseClaim.model');
const ArrearsLedger = require('../../models/arrearsLedger.model');

jest.mock('../../models/attendance.model', () => ({
  find: jest.fn(() => ({ select: jest.fn().mockResolvedValue([]) })),
}));
jest.mock('../../models/salaryStructure.model', () => ({
  find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([]) })),
}));
jest.mock('../../services/cache.service', () => ({
  invalidateAnalytics: jest.fn().mockResolvedValue(undefined),
  invalidateDashboardSummary: jest.fn().mockResolvedValue(undefined),
}));

const OWNER = '507f1f77bcf86cd799439011';
const TENANT = '507f1f77bcf86cd799439099';
const EMP_A = '607f1f77bcf86cd7994390a1';
const PAYROLL_ID = '807f1f77bcf86cd7994390c1';
const LEDGER_ID = '907f1f77bcf86cd7994390f1';

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const queryMock = (data) => ({
  sort: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  setOptions: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(data),
  then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
  catch: (reject) => Promise.resolve(data).catch(reject),
});

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const employee = {
  _id: oid(EMP_A),
  fullName: 'Alice Smith',
  monthlySalary: 30000,
  overtimeRate: 0,
  isActive: true,
  currency: 'INR',
};

/** An unreleased ledger row worth `amount`. */
const ledgerRow = (amount) => ({
  _id: oid(LEDGER_ID),
  employeeId: oid(EMP_A),
  tenantId: oid(TENANT),
  targetMonth: 2,
  targetYear: 2026,
  netArrearsPayout: amount,
  proRatedDays: null,
  totalDaysInMonth: 28,
  isReleased: false,
});

/** The single payroll row the write path produces, as handed to bulkWrite. */
const writtenRow = () =>
  PayrollUpdate.bulkWrite.mock.calls[0][0][0].updateOne.update.$set;

let req;
let res;
let next;
let session;

beforeEach(() => {
  jest.clearAllMocks();

  session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);

  req = {
    userId: OWNER,
    tenantId: TENANT,
    body: {
      month: 3,
      year: 2026,
      activities: [{ employeeId: EMP_A, name: 'Alice Smith', tags: [] }],
    },
  };
  res = makeRes();
  next = jest.fn();

  Employee.find.mockResolvedValue([employee]);
  User.findById.mockResolvedValue({
    defaultDailyRate: 0,
    defaultOvertimeRate: 0,
  });

  PayrollUpdate.bulkWrite.mockResolvedValue({});
  PayrollUpdate.find
    .mockImplementationOnce(() => queryMock([])) // locked-record guard
    .mockImplementation(() =>
      queryMock([{ _id: oid(PAYROLL_ID), employeeId: oid(EMP_A) }]),
    );

  Loan.find.mockResolvedValue([]);
  Loan.updateOne.mockResolvedValue({});

  ExpenseClaim.find.mockReturnValue(queryMock([]));
  ExpenseClaim.bulkWrite.mockResolvedValue({});

  ArrearsLedger.find = jest.fn(() => ({
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  }));
  ArrearsLedger.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Point the ledger read at `rows` for the employee under test. */
const withArrears = (rows) => {
  ArrearsLedger.find.mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  });
};

describe('a run with no arrears anywhere (#950)', () => {
  it('completes instead of answering 500', async () => {
    // The regression. Before the fix this reached
    // `require('../utils/arrearsCalculator')` inside the per-employee loop,
    // threw MODULE_NOT_FOUND, and every payroll submission for every tenant
    // ended at the error handler.
    await submitPayrollForReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(PayrollUpdate.bulkWrite).toHaveBeenCalled();
  });

  it('writes a net salary with no arrears line', async () => {
    await submitPayrollForReview(req, res, next);

    const row = writtenRow();

    expect(row.netSalary).toBe(30000);
    expect(row.arrearsPayout).toBe(0);
    expect(row.arrearsLedgerIds).toEqual([]);
    expect(ArrearsLedger.updateMany).not.toHaveBeenCalled();
  });
});

describe('a run that releases arrears', () => {
  it('adds them to net pay and records them in their own column', async () => {
    withArrears([ledgerRow(4500)]);

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();

    expect(row.netSalary).toBe(34500);
    // Not this month's earnings, so the bonus column does not move — the same
    // separation `reimbursements` has, for the same reason.
    expect(row.arrearsPayout).toBe(4500);
    expect(row.bonus).toBe(0);
    expect(row.arrearsBreakdown).toEqual([
      expect.objectContaining({ month: 2, year: 2026, amount: 4500 }),
    ]);
  });

  it('retires the ledger rows against the payroll row that paid them', async () => {
    withArrears([ledgerRow(4500)]);

    await submitPayrollForReview(req, res, next);

    expect(ArrearsLedger.updateMany).toHaveBeenCalledTimes(1);

    const [filter, update, options] = ArrearsLedger.updateMany.mock.calls[0];

    expect(filter._id.$in.map(String)).toEqual([LEDGER_ID]);
    expect(String(filter.tenantId)).toBe(TENANT);
    expect(String(update.$set.releasedInPayrollId)).toBe(PAYROLL_ID);
    expect(update.$set.isReleased).toBe(true);
    // In the same transaction as the payroll write. Released outside it, an
    // abort leaves the rows flagged paid and the money never reaches anybody.
    expect(options.session).toBe(session);
  });

  it('releases before the transaction is committed', async () => {
    withArrears([ledgerRow(4500)]);

    await submitPayrollForReview(req, res, next);

    const releasedAt = ArrearsLedger.updateMany.mock.invocationCallOrder[0];
    const committedAt = session.commitTransaction.mock.invocationCallOrder[0];

    expect(releasedAt).toBeLessThan(committedAt);
  });

  it('leaves the rows unreleased when no payroll row was written for them', async () => {
    withArrears([ledgerRow(4500)]);
    // The post-write fetch comes back without this employee's row.
    PayrollUpdate.find.mockReset();
    PayrollUpdate.find
      .mockImplementationOnce(() => queryMock([]))
      .mockImplementation(() => queryMock([]));

    await submitPayrollForReview(req, res, next);

    // Unreleased is recoverable; released against nothing is not.
    expect(ArrearsLedger.updateMany).not.toHaveBeenCalled();
  });

  it('reports the payout back to the caller', async () => {
    withArrears([ledgerRow(4500)]);

    await submitPayrollForReview(req, res, next);

    const payload = res.json.mock.calls[0][0];

    expect(payload.results[0]).toMatchObject({
      netSalary: 34500,
      arrearsPayout: 4500,
    });
  });
});
