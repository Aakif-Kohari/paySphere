/**
 * Payroll <- attendance ledger integration (#459).
 *
 * The point of the ledger is that `leaveDays` and `overtimeHours` stop being
 * scraped out of display strings. These tests pin that: given a recorded month,
 * the figures the salary calculator receives come from the ledger's validated
 * totals and *not* from the activity tags, even when the two disagree.
 */

const mongoose = require('mongoose');
const { submitPayrollForReview } = require('../payroll.controller');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const User = require('../../models/user.model');
const Attendance = require('../../models/attendance.model');

jest.mock('../../models/employee.model');
jest.mock('../../models/payroll.model');
jest.mock('../../models/user.model');
// Read once per employee in a run, to bundle anything owed from a backdated
// salary revision (#931). Mocked as a factory rather than automocked so the
// query never reaches Mongoose: unmocked, it buffers against a database this
// suite never connects to and every test in the file times out (#950).
jest.mock('../../models/arrearsLedger.model', () => ({
  find: jest.fn(() => ({
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  })),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  insertMany: jest.fn().mockResolvedValue([]),
}));
// Expense claims are read for every employee in a run since #719. Same reason
// as the mock above: unmocked it buffers and the whole suite times out.
jest.mock('../../models/expenseClaim.model', () => ({
  find: jest.fn(() => ({
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  })),
  bulkWrite: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../models/attendance.model');
// Payroll also recovers loan instalments (#460); stubbed so this suite stays
// focused on the attendance ledger.
jest.mock('../../models/loan.model', () => ({
  find: jest.fn().mockResolvedValue([]),
  updateOne: jest.fn().mockResolvedValue({}),
}));
// Payroll also snapshots the salary breakdown (#461); stubbed so this suite
// stays focused on the attendance ledger.
jest.mock('../../models/salaryStructure.model', () => ({
  find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([]) })),
}));
jest.mock('../../services/cache.service', () => ({
  invalidateAnalytics: jest.fn().mockResolvedValue(undefined),
  invalidateDashboardSummary: jest.fn().mockResolvedValue(undefined),
}));

const OWNER = '507f1f77bcf86cd799439011';
// The company. A different id from OWNER on purpose: since #613 the scope is
// the tenant, not the account that created the row.
const TENANT = '507f1f77bcf86cd799439099';
const EMP_A = '607f1f77bcf86cd7994390a1';

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const queryMock = (data) => ({
  sort: jest.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
  catch: (reject) => Promise.resolve(data).catch(reject),
});

const selectMock = (data) => ({ select: jest.fn().mockResolvedValue(data) });

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const employee = {
  _id: oid(EMP_A),
  fullName: 'Alice Smith',
  monthlySalary: 30000,
  overtimeRate: 100,
  isActive: true,
  currency: 'INR',
};

let req;
let res;
let next;
let mockSession;

beforeEach(() => {
  jest.clearAllMocks();

  // Without this the controller opens a real session and the test hangs
  // waiting on a database that is not there.
  mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

  req = {
    userId: OWNER,
    tenantId: TENANT,
    body: {
      month: 7,
      year: 2026,
      activities: [
        {
          employeeId: EMP_A,
          name: 'Alice Smith',
          // The tag path would read 9 leave days and 12 overtime hours here.
          tags: [
            { label: '– 9 days leave' },
            { label: '+ 12 hr overtime' },
          ],
        },
      ],
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
      queryMock([{ _id: oid('607f1f77bcf86cd7994390ff'), employeeId: oid(EMP_A) }]),
    );

  Attendance.find.mockImplementation(() => selectMock([]));
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The $set payload bulkWrite was asked to persist for the first employee. */
const writtenRow = () => PayrollUpdate.bulkWrite.mock.calls[0][0][0].updateOne.update.$set;

describe('payroll prefers the attendance ledger over parsed tags', () => {
  test('with no recorded month it falls back to the tag path, marked "manual"', async () => {
    Attendance.find.mockImplementation(() => selectMock([]));

    await submitPayrollForReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const row = writtenRow();
    expect(row.attendanceSource).toBe('manual');
    expect(row.leaveDays).toBe(9);
    expect(row.overtimeHours).toBe(12);
  });

  test('a recorded month overrides the tags entirely', async () => {
    Attendance.find.mockImplementation(() =>
      selectMock([
        {
          employeeId: oid(EMP_A),
          totals: {
            present: 20,
            halfDay: 2,
            paidLeave: 3,
            unpaidLeave: 2.5,
            overtimeHours: 6,
          },
        },
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();
    expect(row.attendanceSource).toBe('ledger');
    // From the ledger (2.5 / 6), not from the tags (9 / 12).
    expect(row.leaveDays).toBe(2.5);
    expect(row.overtimeHours).toBe(6);
  });

  test('paid leave in the ledger does not reduce salary', async () => {
    // The pre-#459 path could not tell paid from unpaid leave, so a company
    // that granted paid leave still docked the employee for it.
    Attendance.find.mockImplementation(() =>
      selectMock([
        {
          employeeId: oid(EMP_A),
          totals: { paidLeave: 5, unpaidLeave: 0, overtimeHours: 0 },
        },
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();
    expect(row.leaveDays).toBe(0);
    expect(row.leaveDeduction).toBe(0);
    expect(row.netSalary).toBe(30000);
  });

  test('half days reach the deduction as 0.5, which the tag path could not express', async () => {
    Attendance.find.mockImplementation(() =>
      selectMock([
        {
          employeeId: oid(EMP_A),
          totals: { paidLeave: 0, unpaidLeave: 1.5, overtimeHours: 0 },
        },
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();
    expect(row.leaveDays).toBe(1.5);
    // 30000/30 = 1000/day * 1.5 = 1500
    expect(row.leaveDeduction).toBe(1500);
    expect(row.netSalary).toBe(28500);
  });

  test('bonus and deductions still come from the tags — they have no ledger equivalent', async () => {
    req.body.activities[0].tags = [
      { label: '+ 5000 bonus' },
      { label: '– 1000 deduction' },
    ];
    Attendance.find.mockImplementation(() =>
      selectMock([
        {
          employeeId: oid(EMP_A),
          totals: { paidLeave: 0, unpaidLeave: 0, overtimeHours: 0 },
        },
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const row = writtenRow();
    expect(row.bonus).toBe(5000);
    expect(row.deductions).toBe(1000);
    expect(row.attendanceSource).toBe('ledger');
  });

  test('the ledger query is scoped to the caller and the run period', async () => {
    await submitPayrollForReview(req, res, next);

    expect(Attendance.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      year: 2026,
      month: 7,
    });
  });

  test('a ledger read failure degrades to the tag path instead of failing the run', async () => {
    // The ledger is an improvement on tag parsing, not a prerequisite for
    // paying people.
    Attendance.find.mockImplementation(() => ({
      select: jest.fn().mockRejectedValue(new Error('collection unavailable')),
    }));

    await submitPayrollForReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(writtenRow().attendanceSource).toBe('manual');
  });

  test('the source is reported back to the caller', async () => {
    Attendance.find.mockImplementation(() =>
      selectMock([
        { employeeId: oid(EMP_A), totals: { unpaidLeave: 1, overtimeHours: 0 } },
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.results[0].attendanceSource).toBe('ledger');
  });

  test('an employee with no ledger row keeps the tag path even when others have one', async () => {
    const other = { ...employee, _id: oid('607f1f77bcf86cd7994390a2'), fullName: 'Bob Jones' };
    Employee.find.mockResolvedValue([employee, other]);

    req.body.activities.push({
      employeeId: '607f1f77bcf86cd7994390a2',
      name: 'Bob Jones',
      tags: [{ label: '– 4 days leave' }],
    });

    Attendance.find.mockImplementation(() =>
      selectMock([
        { employeeId: oid(EMP_A), totals: { unpaidLeave: 1, overtimeHours: 0 } },
      ]),
    );

    await submitPayrollForReview(req, res, next);

    const ops = PayrollUpdate.bulkWrite.mock.calls[0][0];
    const alice = ops[0].updateOne.update.$set;
    const bob = ops[1].updateOne.update.$set;

    expect(alice.attendanceSource).toBe('ledger');
    expect(alice.leaveDays).toBe(1);
    expect(bob.attendanceSource).toBe('manual');
    expect(bob.leaveDays).toBe(4);
  });
});
