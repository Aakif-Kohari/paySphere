/**
 * Payroll <- loan recovery integration (#460).
 *
 * The properties that matter here are the ones the manual-`deductions`
 * workaround could not provide: recovery is idempotent across re-runs, it never
 * drives net salary below zero, and a settled loan stops being collected.
 */

const mongoose = require('mongoose');
const { submitPayrollForReview } = require('../payroll.controller');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const User = require('../../models/user.model');
const Loan = require('../../models/loan.model');
const { LOAN_STATUS, buildAmortizationSchedule } = require('../../utils/loanSchedule');

jest.mock('../../models/employee.model');
jest.mock('../../models/payroll.model');
jest.mock('../../models/user.model');
jest.mock('../../models/loan.model');
// Payroll also consults the attendance ledger (#459); stubbed so this suite
// stays focused on loan recovery.
jest.mock('../../models/attendance.model', () => ({
  find: jest.fn(() => ({ select: jest.fn().mockResolvedValue([]) })),
}));
// Payroll also snapshots the salary breakdown (#461); stubbed so this suite
// stays focused on loan recovery.
jest.mock('../../models/salaryStructure.model', () => ({
  find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([]) })),
}));
jest.mock('../../services/cache.service', () => ({
  invalidateAnalytics: jest.fn().mockResolvedValue(undefined),
}));

const OWNER = '507f1f77bcf86cd799439011';
// The company. A different id from OWNER on purpose: since #613 the scope is
// the tenant, not the account that created the row.
const TENANT = '507f1f77bcf86cd799439099';
const EMP_A = '607f1f77bcf86cd7994390a1';
const LOAN_ID = '707f1f77bcf86cd7994390b1';

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const queryMock = (data) => ({
  sort: jest.fn().mockReturnThis(),
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

/** An active 12 x 1000 interest-free advance starting January 2026. */
const activeLoan = (overrides = {}) => {
  const built = buildAmortizationSchedule({
    principal: 12000,
    tenureMonths: 12,
    interestMethod: 'none',
    interestRatePercent: 0,
    startMonth: 1,
    startYear: 2026,
  });

  return {
    _id: oid(LOAN_ID),
    employeeId: oid(EMP_A),
    createdBy: oid(OWNER),
    tenantId: oid(TENANT),
    status: LOAN_STATUS.ACTIVE,
    principal: 12000,
    totalPayable: 12000,
    installmentAmount: built.installmentAmount,
    tenureMonths: 12,
    startMonth: 1,
    startYear: 2026,
    schedule: built.schedule,
    repayments: [],
    ...overrides,
  };
};

/**
 * A loan whose *outstanding balance* exceeds one month's net salary.
 *
 * Simply inflating `installmentAmount` does not exercise the affordability cap:
 * recovery is already bounded by what is actually owed, so a 50,000 instalment
 * against a 12,000 balance only ever collects 12,000. The cap engages when the
 * genuine debt is larger than the pay.
 */
const unaffordableLoan = () => {
  const built = buildAmortizationSchedule({
    principal: 60000,
    tenureMonths: 1,
    interestMethod: 'none',
    interestRatePercent: 0,
    startMonth: 1,
    startYear: 2026,
  });

  return {
    _id: oid(LOAN_ID),
    employeeId: oid(EMP_A),
    createdBy: oid(OWNER),
    tenantId: oid(TENANT),
    status: LOAN_STATUS.ACTIVE,
    principal: 60000,
    totalPayable: 60000,
    installmentAmount: built.installmentAmount, // 60000
    tenureMonths: 1,
    startMonth: 1,
    startYear: 2026,
    schedule: built.schedule,
    repayments: [],
  };
};

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
  User.findById.mockResolvedValue({ defaultDailyRate: 0, defaultOvertimeRate: 0 });

  PayrollUpdate.bulkWrite.mockResolvedValue({});
  PayrollUpdate.find
    .mockImplementationOnce(() => queryMock([])) // locked-record guard
    .mockImplementationOnce(() =>
      queryMock([{ _id: oid('807f1f77bcf86cd7994390c1'), employeeId: oid(EMP_A) }]),
    );

  Loan.find.mockResolvedValue([]);
  Loan.updateOne.mockResolvedValue({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const writtenRow = () => PayrollUpdate.bulkWrite.mock.calls[0][0][0].updateOne.update.$set;

describe('loan recovery during payroll', () => {
  test('with no loans, net salary is untouched', async () => {
    await submitPayrollForReview(req, res, next);

    const row = writtenRow();
    expect(row.netSalary).toBe(30000);
    expect(row.loanRecoveryTotal).toBe(0);
    expect(row.loanRecoveries).toEqual([]);
  });

  test('an active loan is recovered and reduces net salary', async () => {
    Loan.find.mockResolvedValue([activeLoan()]);

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();
    expect(row.loanRecoveryTotal).toBe(1000);
    expect(row.netSalary).toBe(29000);
    expect(row.loanRecoveries).toHaveLength(1);
    expect(String(row.loanRecoveries[0].loanId)).toBe(LOAN_ID);
  });

  test('the loan ledger is written after the payroll commit', async () => {
    Loan.find.mockResolvedValue([activeLoan()]);

    await submitPayrollForReview(req, res, next);

    expect(Loan.updateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = Loan.updateOne.mock.calls[0];
    expect(filter.tenantId).toBe(TENANT);
    expect(update.$set.totalRepaid).toBe(1000);
    expect(update.$set.outstanding).toBe(11000);
    expect(update.$set.repayments).toHaveLength(1);
  });

  test('re-running the same month does not collect twice', async () => {
    // The approval workflow explicitly allows a rejected run to be
    // re-submitted, so this path is reachable in normal use.
    const loan = activeLoan({
      repayments: [
        { month: 3, year: 2026, amount: 1000, principalComponent: 1000, interestComponent: 0 },
      ],
    });
    Loan.find.mockResolvedValue([loan]);

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();
    // The recovery line is reproduced, so the payroll row is identical...
    expect(row.loanRecoveryTotal).toBe(1000);
    expect(row.netSalary).toBe(29000);
    // ...but the ledger is not written again.
    expect(Loan.updateOne).not.toHaveBeenCalled();
  });

  test('recovery is capped so net salary can never go negative', async () => {
    Loan.find.mockResolvedValue([unaffordableLoan()]);

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();
    expect(row.netSalary).toBe(0);
    expect(row.loanRecoveryTotal).toBe(30000);
    // The uncollected 30,000 carries forward — the loan is not forgiven.
    expect(row.loanRecoveries[0].shortfall).toBe(30000);
  });

  test('an uncollectable shortfall is reported, not silently forgiven', async () => {
    Loan.find.mockResolvedValue([unaffordableLoan()]);

    await submitPayrollForReview(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.errors.some((e) => e.includes('short by'))).toBe(true);
  });

  test('a loan on hold is not collected', async () => {
    Loan.find.mockResolvedValue([activeLoan({ status: LOAN_STATUS.ON_HOLD })]);

    await submitPayrollForReview(req, res, next);

    expect(writtenRow().loanRecoveryTotal).toBe(0);
    expect(Loan.updateOne).not.toHaveBeenCalled();
  });

  test('a loan that has not started yet is not collected', async () => {
    Loan.find.mockResolvedValue([activeLoan({ startMonth: 9, startYear: 2026 })]);

    await submitPayrollForReview(req, res, next);

    expect(writtenRow().loanRecoveryTotal).toBe(0);
  });

  test('the final instalment collects only the remaining balance', async () => {
    const loan = activeLoan({
      repayments: [{ month: 1, year: 2026, amount: 11600 }],
    });
    Loan.find.mockResolvedValue([loan]);

    await submitPayrollForReview(req, res, next);

    expect(writtenRow().loanRecoveryTotal).toBe(400);
  });

  test('a loan settled by this run is auto-completed', async () => {
    // Otherwise it keeps being recovered until someone remembers to close it.
    const loan = activeLoan({
      repayments: [{ month: 1, year: 2026, amount: 11600 }],
    });
    Loan.find.mockResolvedValue([loan]);

    await submitPayrollForReview(req, res, next);

    const update = Loan.updateOne.mock.calls[0][1].$set;
    expect(update.outstanding).toBe(0);
    expect(update.status).toBe(LOAN_STATUS.COMPLETED);
    expect(update.completedAt).toBeInstanceOf(Date);
  });

  test("the loan query is scoped to the caller's company and to active loans only", async () => {
    await submitPayrollForReview(req, res, next);

    expect(Loan.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      status: LOAN_STATUS.ACTIVE,
    });
  });

  test('a loan-ledger read failure skips recovery instead of failing the run', async () => {
    // Skipping recovery under-collects for one month, which is recoverable.
    // Failing the run means nobody gets paid, which is not.
    Loan.find.mockRejectedValue(new Error('collection unavailable'));

    await submitPayrollForReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(writtenRow().netSalary).toBe(30000);
  });

  test('a ledger write failure does not roll back the committed salary', async () => {
    Loan.find.mockResolvedValue([activeLoan()]);
    Loan.updateOne.mockRejectedValue(new Error('write failed'));

    await submitPayrollForReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('multiple loans share a limited budget, oldest first', async () => {
    const older = activeLoan({ _id: oid('707f1f77bcf86cd7994390b1'), startMonth: 1 });
    const newer = { ...unaffordableLoan(), _id: oid('707f1f77bcf86cd7994390b2'), startMonth: 2 };

    Loan.find.mockResolvedValue([newer, older]);

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();
    expect(row.loanRecoveryTotal).toBe(30000);
    // The older loan is serviced in full before the newer one gets anything —
    // otherwise a long-running advance is starved by every new one.
    expect(row.loanRecoveries[0].amount).toBe(1000);
    expect(row.loanRecoveries[1].amount).toBe(29000);
  });

  test('the recovery is reported back to the caller', async () => {
    Loan.find.mockResolvedValue([activeLoan()]);

    await submitPayrollForReview(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.results[0].loanRecoveryTotal).toBe(1000);
  });
});
