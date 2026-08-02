const mongoose = require('mongoose');
const {
  getAttendance,
  upsertAttendance,
  bulkMarkAttendance,
  getMonthSummary,
  getLeaveBalance,
} = require('../attendance.controller');

const Attendance = require('../../models/attendance.model');
const Employee = require('../../models/employee.model');
const User = require('../../models/user.model');
const PayrollUpdate = require('../../models/payroll.model');
const eventBus = require('../../services/event.service');
const AppError = require('../../utils/AppError');

jest.mock('../../models/attendance.model');
jest.mock('../../models/employee.model');
jest.mock('../../models/user.model');
jest.mock('../../models/payroll.model');

const OWNER = '507f1f77bcf86cd799439011';
const EMP_A = '607f1f77bcf86cd7994390a1';
const EMP_B = '607f1f77bcf86cd7994390a2';

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const selectMock = (data) => ({ select: jest.fn().mockResolvedValue(data) });

const sortMock = (data) => ({ sort: jest.fn().mockResolvedValue(data) });

const employeeDoc = (id = EMP_A, overrides = {}) => ({
  _id: oid(id),
  fullName: 'Alice Smith',
  createdBy: oid(OWNER),
  joiningDate: new Date('2020-01-01'),
  ...overrides,
});

const day = (d, status, overtimeHours = 0) => ({ day: d, status, overtimeHours });

beforeEach(() => {
  jest.clearAllMocks();

  Employee.findOne.mockResolvedValue(employeeDoc());
  User.findById.mockImplementation(() => selectMock({ settings: {} }));
  Attendance.findOne.mockResolvedValue(null);
  Attendance.find.mockImplementation(() => selectMock([]));
  Attendance.findOneAndUpdate.mockImplementation((filter, update) =>
    Promise.resolve({ _id: oid('607f1f77bcf86cd7994390ff'), ...update.$set }),
  );
  Attendance.updateOne.mockResolvedValue({});
  PayrollUpdate.findOne.mockImplementation(() => selectMock(null));
});

describe('getAttendance — ownership and defaults (#459)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { userId: OWNER, query: { employeeId: EMP_A, year: '2026', month: '7' } };
    res = makeRes();
    next = jest.fn();
  });

  test('scopes the employee lookup by createdBy', async () => {
    await getAttendance(req, res, next);

    expect(Employee.findOne).toHaveBeenCalledWith({
      _id: EMP_A,
      createdBy: OWNER,
    });
  });

  test("another company's employee is a 404, not a leak", async () => {
    // The scoped lookup returns nothing, and the message is deliberately
    // indistinguishable from "no such employee".
    Employee.findOne.mockResolvedValue(null);

    await getAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Employee not found');
  });

  test('rejects a malformed employee id before touching the database', async () => {
    req.query.employeeId = 'not-an-id';

    await getAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(Employee.findOne).not.toHaveBeenCalled();
  });

  test('rejects an out-of-range month and year', async () => {
    for (const query of [
      { employeeId: EMP_A, month: '13', year: '2026' },
      { employeeId: EMP_A, month: '7', year: '1990' },
    ]) {
      jest.clearAllMocks();
      req.query = query;
      await getAttendance(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    }
  });

  test('generates a default grid for a month never recorded', async () => {
    Attendance.findOne.mockResolvedValue(null);

    await getAttendance(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.isRecorded).toBe(false);
    expect(payload.days).toHaveLength(31);
    // A default month must cost the employee nothing.
    expect(payload.totals.paidLeave).toBe(0);
    expect(payload.totals.unpaidLeave).toBe(0);
  });

  test('returns the stored grid when the month has been recorded', async () => {
    Attendance.findOne.mockResolvedValue({
      _id: oid('607f1f77bcf86cd7994390fe'),
      days: [day(1, 'absent'), day(2, 'present')],
      totals: { unpaidLeave: 1, paidLeave: 0, overtimeHours: 0 },
      lockedAt: null,
    });

    await getAttendance(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.isRecorded).toBe(true);
    expect(payload.days).toHaveLength(2);
    expect(payload.payrollInputs.leaveDays).toBe(1);
  });

  test('reports the month as locked once its payroll is paid', async () => {
    PayrollUpdate.findOne.mockImplementation(() =>
      selectMock({ _id: oid('607f1f77bcf86cd7994390fd'), status: 'paid' }),
    );

    await getAttendance(req, res, next);

    expect(res.json.mock.calls[0][0].isLocked).toBe(true);
  });

  test('includes the leave balance snapshot', async () => {
    await getAttendance(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.balance).toBeDefined();
    expect(typeof payload.balance.available).toBe('number');
  });

  test('reports the real length of the month', async () => {
    req.query = { employeeId: EMP_A, year: '2026', month: '2' };

    await getAttendance(req, res, next);

    expect(res.json.mock.calls[0][0].daysInMonth).toBe(28);
  });
});

describe('upsertAttendance — validation, totals and locking (#459)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      params: { employeeId: EMP_A, year: '2026', month: '7' },
      body: { days: [day(1, 'present'), day(2, 'absent')] },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('saves a valid grid', async () => {
    await upsertAttendance(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Attendance.findOneAndUpdate).toHaveBeenCalled();
  });

  test('scopes the write by createdBy', async () => {
    await upsertAttendance(req, res, next);

    const filter = Attendance.findOneAndUpdate.mock.calls[0][0];
    expect(filter.createdBy).toBe(OWNER);
    expect(String(filter.employeeId)).toBe(EMP_A);
  });

  test('recomputes the totals server-side and ignores any the client sent', async () => {
    // A client that could post its own totals could post a month of absences
    // summing to zero unpaid days.
    req.body = {
      days: [day(1, 'absent'), day(2, 'absent'), day(3, 'half_day')],
      totals: { unpaidLeave: 0, paidLeave: 0, overtimeHours: 999 },
    };

    await upsertAttendance(req, res, next);

    const written = Attendance.findOneAndUpdate.mock.calls[0][1].$set;
    expect(written.totals.unpaidLeave).toBe(2.5);
    expect(written.totals.overtimeHours).toBe(0);
  });

  test('rejects an invalid grid with per-day reasons', async () => {
    req.body = { days: [day(99, 'present'), day(1, 'nonsense')] };

    await upsertAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.extra.errors).toHaveLength(2);
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('rejects a day outside the month', async () => {
    req.params = { employeeId: EMP_A, year: '2026', month: '2' };
    req.body = { days: [day(30, 'absent')] };

    await upsertAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  test('refuses to edit a month whose payroll has been paid', async () => {
    PayrollUpdate.findOne.mockImplementation(() =>
      selectMock({ _id: oid('607f1f77bcf86cd7994390fd'), status: 'paid' }),
    );

    await upsertAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(409);
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('refuses to edit an already-locked document', async () => {
    Attendance.findOne.mockResolvedValue({
      _id: oid('607f1f77bcf86cd7994390fe'),
      lockedAt: new Date('2026-08-01'),
      days: [],
      totals: {},
    });

    await upsertAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(409);
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("another company's employee cannot be written to", async () => {
    Employee.findOne.mockResolvedValue(null);

    await upsertAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('returns the derived payroll inputs so the caller can preview the effect', async () => {
    req.body = { days: [day(1, 'absent'), day(2, 'overtime', 4)] };

    await upsertAttendance(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.payrollInputs).toEqual({ leaveDays: 1, overtimeHours: 4 });
  });

  test('warns without blocking when the month overdraws the leave balance', async () => {
    // Whether to grant leave in advance is the employer's call; refusing the
    // whole write would leave the rest of the month unsaved.
    User.findById.mockImplementation(() =>
      selectMock({ settings: { leavePolicy: { annualPaidLeaveDays: 1 } } }),
    );
    req.body = { days: [1, 2, 3, 4, 5].map((d) => day(d, 'paid_leave')) };

    await upsertAttendance(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].leaveWarning).not.toBeNull();
  });

  test('emits an attendance audit event — this is a financial mutation', async () => {
    const emitSpy = jest.spyOn(eventBus, 'emit');

    await upsertAttendance(req, res, next);

    const auditCall = emitSpy.mock.calls.find(
      ([event, payload]) =>
        event === 'AUDIT_LOG' && payload.action === 'ATTENDANCE_UPDATE',
    );
    expect(auditCall).toBeDefined();
    expect(auditCall[1].resourceType).toBe('Attendance');
    emitSpy.mockRestore();
  });

  test('a concurrent save on the unique index is a 409, not a 500', async () => {
    const duplicate = new Error('E11000 duplicate key');
    duplicate.code = 11000;
    Attendance.findOneAndUpdate.mockRejectedValue(duplicate);

    await upsertAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe(
      'Attendance for this month was updated concurrently. Reload and retry.',
    );
  });

  test('an unexpected error is forwarded to the error handler', async () => {
    Attendance.findOneAndUpdate.mockRejectedValue(new Error('connection lost'));

    await upsertAttendance(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('bulkMarkAttendance (#459)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      body: {
        employeeIds: [EMP_A, EMP_B],
        year: 2026,
        month: 7,
        status: 'holiday',
        fromDay: 10,
        toDay: 12,
      },
    };
    res = makeRes();
    next = jest.fn();

    Employee.find.mockResolvedValue([
      employeeDoc(EMP_A),
      employeeDoc(EMP_B, { fullName: 'Bob Jones' }),
    ]);
    Attendance.find.mockImplementation((filter) =>
      filter && filter.year ? Promise.resolve([]) : selectMock([]),
    );
  });

  test('scopes the employee fetch by createdBy', async () => {
    await bulkMarkAttendance(req, res, next);

    expect(Employee.find).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: OWNER }),
    );
  });

  test('applies the status across the requested range for each employee', async () => {
    await bulkMarkAttendance(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Attendance.findOneAndUpdate).toHaveBeenCalledTimes(2);

    const written = Attendance.findOneAndUpdate.mock.calls[0][1].$set;
    const marked = written.days.filter((d) => d.day >= 10 && d.day <= 12);
    expect(marked).toHaveLength(3);
    marked.forEach((d) => expect(d.status).toBe('holiday'));
  });

  test('rejects an unknown status', async () => {
    req.body.status = 'sabbatical';

    await bulkMarkAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  test('rejects an inverted or out-of-range day span', async () => {
    for (const range of [
      { fromDay: 12, toDay: 10 },
      { fromDay: 0, toDay: 5 },
      { fromDay: 1, toDay: 40 },
    ]) {
      jest.clearAllMocks();
      Employee.find.mockResolvedValue([employeeDoc()]);
      req.body = { ...req.body, ...range };
      await bulkMarkAttendance(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    }
  });

  test('rejects an empty or oversized employee list', async () => {
    for (const employeeIds of [[], null, new Array(201).fill(EMP_A)]) {
      jest.clearAllMocks();
      req.body = { ...req.body, employeeIds };
      await bulkMarkAttendance(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    }
  });

  test('404s when no id in the batch belongs to the caller', async () => {
    Employee.find.mockResolvedValue([]);

    await bulkMarkAttendance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(Attendance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('skips locked months and reports them rather than failing the batch', async () => {
    Attendance.find.mockImplementation((filter) =>
      filter && filter.year
        ? Promise.resolve([
            {
              employeeId: oid(EMP_A),
              lockedAt: new Date('2026-08-01'),
              days: [],
              totals: {},
            },
          ])
        : selectMock([]),
    );

    await bulkMarkAttendance(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.skipped).toHaveLength(1);
    expect(payload.updated).toHaveLength(1);
    expect(payload.skipped[0].reason).toContain('locked');
  });

  test('marks the audit result partial when part of the batch was skipped', async () => {
    const emitSpy = jest.spyOn(eventBus, 'emit');
    Attendance.find.mockImplementation((filter) =>
      filter && filter.year
        ? Promise.resolve([
            { employeeId: oid(EMP_A), lockedAt: new Date(), days: [], totals: {} },
          ])
        : selectMock([]),
    );

    await bulkMarkAttendance(req, res, next);

    const auditCall = emitSpy.mock.calls.find(
      ([, payload]) => payload && payload.action === 'ATTENDANCE_BULK_UPDATE',
    );
    expect(auditCall[1].result).toBe('partial');
    emitSpy.mockRestore();
  });

  test('de-duplicates repeated ids', async () => {
    req.body.employeeIds = [EMP_A, EMP_A, EMP_B];

    await bulkMarkAttendance(req, res, next);

    const filter = Employee.find.mock.calls[0][0];
    expect(filter._id.$in).toHaveLength(2);
  });
});

describe('getMonthSummary (#459)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { userId: OWNER, query: { year: '2026', month: '7' } };
    res = makeRes();
    next = jest.fn();
  });

  test('scopes by createdBy', async () => {
    Attendance.find.mockImplementation(() => sortMock([]));

    await getMonthSummary(req, res, next);

    expect(Attendance.find).toHaveBeenCalledWith({
      createdBy: OWNER,
      year: 2026,
      month: 7,
    });
  });

  test('aggregates the month across employees', async () => {
    Attendance.find.mockImplementation(() =>
      sortMock([
        {
          employeeId: oid(EMP_A),
          employeeName: 'Alice Smith',
          totals: { unpaidLeave: 1.5, paidLeave: 2, overtimeHours: 4 },
          lockedAt: null,
        },
        {
          employeeId: oid(EMP_B),
          employeeName: 'Bob Jones',
          totals: { unpaidLeave: 0.5, paidLeave: 0, overtimeHours: 2.5 },
          lockedAt: null,
        },
      ]),
    );

    await getMonthSummary(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.employeeCount).toBe(2);
    expect(payload.totals.unpaidLeave).toBe(2);
    expect(payload.totals.overtimeHours).toBe(6.5);
    expect(payload.summary[0].payrollInputs.leaveDays).toBe(1.5);
  });

  test('rejects an invalid period', async () => {
    req.query = { year: '2026', month: '0' };

    await getMonthSummary(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });
});

describe('getLeaveBalance (#459)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { userId: OWNER, query: { employeeId: EMP_A, year: '2026', month: '9' } };
    res = makeRes();
    next = jest.fn();
  });

  test('returns a balance scoped to the caller', async () => {
    await getLeaveBalance(req, res, next);

    expect(Employee.findOne).toHaveBeenCalledWith({
      _id: EMP_A,
      createdBy: OWNER,
    });

    const payload = res.json.mock.calls[0][0];
    expect(payload.balance.entitlement).toBeGreaterThan(0);
    expect(payload.balance).toHaveProperty('available');
  });

  test("refuses another company's employee", async () => {
    Employee.findOne.mockResolvedValue(null);

    await getLeaveBalance(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });

  test('reflects consumption from the recorded history', async () => {
    Attendance.find.mockImplementation(() =>
      selectMock([{ year: 2026, month: 5, totals: { paidLeave: 2 } }]),
    );

    await getLeaveBalance(req, res, next);

    expect(res.json.mock.calls[0][0].balance.consumed).toBe(2);
  });
});
