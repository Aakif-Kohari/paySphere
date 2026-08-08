/**
 * Payroll <- expense reimbursement integration (#719, #794).
 *
 * The property that matters and was never checked: a claim only ever gets
 * marked `reimbursed` if the money it is worth actually reached the employee's
 * net pay. #719 added a taxable claim to the stored `bonus` column *after*
 * `calculateNetSalary` had already run, so the payslip showed a larger bonus,
 * net pay did not move, and the claim was retired anyway — unrecoverable,
 * because `payrollId` was then set.
 */

const mongoose = require('mongoose');

jest.mock('../../models/employee.model');
jest.mock('../../models/user.model');
jest.mock('../../models/loan.model');
jest.mock('../../models/expenseClaim.model');
// Declared as a factory rather than an automock so jest never has to load the
// real module to build the mock. On `main` that file does not parse — a merge
// left two copies of the schema in it (#792) — and this suite is about the
// controller's arithmetic, not about the schema.
jest.mock('../../models/payroll.model', () => ({
  find: jest.fn(),
  bulkWrite: jest.fn(),
  updateMany: jest.fn(),
  countDocuments: jest.fn(),
}));
// Same reason: `services/anomaly.service.js` requires './logger', which is not
// there, and `payroll.controller` requires it (#792).
jest.mock('../../services/anomaly.service', () => ({
  detect: jest.fn(() => []),
}));

const { submitPayrollForReview } = require('../payroll.controller');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const User = require('../../models/user.model');
const Loan = require('../../models/loan.model');
const ExpenseClaim = require('../../models/expenseClaim.model');
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

/** An approved, unreimbursed claim. */
const claim = ({ id, amount, isTaxable, date = new Date(2026, 2, 12) }) => ({
  _id: oid(id),
  employeeId: oid(EMP_A),
  amount,
  expenseDate: date,
  categoryId: {
    _id: oid('907f1f77bcf86cd7994390d1'),
    isTaxable,
    name: 'Travel',
  },
});

/** The single payroll row the write path produces, as written to bulkWrite. */
const writtenRow = () =>
  PayrollUpdate.bulkWrite.mock.calls[0][0][0].updateOne.update.$set;

let req;
let res;
let next;

beforeEach(() => {
  jest.clearAllMocks();

  jest.spyOn(mongoose, 'startSession').mockResolvedValue({
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  });

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
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('a tax-free claim (#794)', () => {
  it('is added to net pay and recorded in its own column', async () => {
    ExpenseClaim.find.mockReturnValue(
      queryMock([
        claim({
          id: '907f1f77bcf86cd7994390e1',
          amount: 800,
          isTaxable: false,
        }),
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();

    // Base 30000, nothing else in play, plus the reimbursement.
    expect(row.netSalary).toBe(30800);
    expect(row.reimbursements).toBe(800);
    // Not earnings, so the bonus column does not move.
    expect(row.bonus).toBe(0);
  });
});

describe('a taxable claim (#794)', () => {
  it('reaches net pay rather than only inflating the bonus column', async () => {
    // The regression. Before this fix: bonus 500, netSalary 30000, claim marked
    // reimbursed. The employee was 500 out of pocket with a payslip saying
    // otherwise.
    ExpenseClaim.find.mockReturnValue(
      queryMock([
        claim({ id: '907f1f77bcf86cd7994390e2', amount: 500, isTaxable: true }),
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();

    expect(row.bonus).toBe(500);
    expect(row.netSalary).toBe(30500);
    // Taxable claims are earnings, not a tax-free reimbursement line.
    expect(row.reimbursements).toBe(0);
  });

  it('stacks on top of a bonus the run already had', async () => {
    req.body.activities = [
      {
        employeeId: EMP_A,
        name: 'Alice Smith',
        tags: [{ label: 'Bonus 1000' }],
      },
    ];
    ExpenseClaim.find.mockReturnValue(
      queryMock([
        claim({ id: '907f1f77bcf86cd7994390e3', amount: 250, isTaxable: true }),
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();

    expect(row.bonus).toBe(1250);
    expect(row.netSalary).toBe(31250);
  });
});

describe('the claims a run picks up (#794)', () => {
  it('asks only for approved, unreimbursed claims in this tenant', async () => {
    await submitPayrollForReview(req, res, next);

    expect(ExpenseClaim.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        status: 'approved',
        payrollId: null,
      }),
    );
  });

  it('carries forward a claim approved after its own month closed', async () => {
    // A receipt dated 20 August, approved on 3 September. The old filter was
    // `expenseDate: { $gte: monthStart, $lte: monthEnd }`, so August's run had
    // closed and September's only looked at September-dated receipts — the
    // claim was stranded permanently. Bounded by the end of the period only.
    await submitPayrollForReview(req, res, next);

    const [filter] = ExpenseClaim.find.mock.calls[0];

    expect(filter.expenseDate.$gte).toBeUndefined();
    expect(filter.expenseDate.$lte).toEqual(
      new Date(2026, 3, 0, 23, 59, 59, 999),
    );
  });

  it('skips a claim whose category no longer resolves instead of failing the run', async () => {
    // `populate` yields null for a dangling reference, and reading `.isTaxable`
    // off it threw a TypeError in the middle of the prepare loop — so one bad
    // claim failed payroll for the whole tenant.
    ExpenseClaim.find.mockReturnValue(
      queryMock([
        {
          ...claim({
            id: '907f1f77bcf86cd7994390e4',
            amount: 300,
            isTaxable: false,
          }),
          categoryId: null,
        },
        claim({
          id: '907f1f77bcf86cd7994390e5',
          amount: 200,
          isTaxable: false,
        }),
      ]),
    );

    await submitPayrollForReview(req, res, next);

    expect(next).not.toHaveBeenCalled();

    const row = writtenRow();
    // Only the claim with a resolvable category was paid.
    expect(row.reimbursements).toBe(200);
  });
});

describe('marking claims reimbursed (#794)', () => {
  it('links each paid claim back to the payroll row that paid it', async () => {
    ExpenseClaim.find.mockReturnValue(
      queryMock([
        claim({
          id: '907f1f77bcf86cd7994390e6',
          amount: 400,
          isTaxable: false,
        }),
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const [ops] = ExpenseClaim.bulkWrite.mock.calls[0];
    const [op] = ops;

    expect(op.updateOne.update.$set).toMatchObject({
      status: 'reimbursed',
      payrollId: oid(PAYROLL_ID),
    });
    expect(op.updateOne.update.$set.reimbursedAt).toBeInstanceOf(Date);
  });

  it('only claims one that is still unreimbursed', async () => {
    // The filter is the last line of defence against paying a claim twice if
    // two runs race: `payrollId: null` makes the update a no-op for a claim
    // another run has already taken.
    ExpenseClaim.find.mockReturnValue(
      queryMock([
        claim({
          id: '907f1f77bcf86cd7994390e7',
          amount: 400,
          isTaxable: false,
        }),
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const [ops] = ExpenseClaim.bulkWrite.mock.calls[0];

    expect(ops[0].updateOne.filter).toMatchObject({
      tenantId: TENANT,
      payrollId: null,
    });
  });

  it('reads the payroll ids inside the transaction', async () => {
    // The bulkWrite upserts these rows, so a read outside the session cannot
    // see them and `payrollId` would be written empty.
    ExpenseClaim.find.mockReturnValue(
      queryMock([
        claim({
          id: '907f1f77bcf86cd7994390e8',
          amount: 400,
          isTaxable: false,
        }),
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const linkQuery = PayrollUpdate.find.mock.results[1].value;

    expect(linkQuery.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ session: expect.anything() }),
    );
  });

  it('touches nothing when there is nothing to reimburse', async () => {
    await submitPayrollForReview(req, res, next);

    expect(ExpenseClaim.bulkWrite).not.toHaveBeenCalled();
  });
});
