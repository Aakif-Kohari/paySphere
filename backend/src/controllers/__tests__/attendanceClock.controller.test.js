/**
 * Clocking in and out (#930, reachable since #953).
 *
 * There was no clock-in endpoint at all — `grep -rn "clock" src/routes
 * src/controllers` matched nothing — so the telemetry #930 added to the schema
 * had no writer, and the office fence it was supposed to be measured against
 * had no way to be created.
 */

const mongoose = require('mongoose');

jest.mock('../../models/attendance.model');
jest.mock('../../models/employee.model');
jest.mock('../../models/officeLocation.model');
jest.mock('../../models/payroll.model', () => ({ findOne: jest.fn() }));
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
  AUDIT_LOG_EVENT: 'AUDIT_LOG',
}));

const Attendance = require('../../models/attendance.model');
const Employee = require('../../models/employee.model');
const OfficeLocation = require('../../models/officeLocation.model');
const PayrollUpdate = require('../../models/payroll.model');
const {
  clockIn,
  clockOut,
  getClockStatus,
  createOfficeLocation,
  updateOfficeLocation,
} = require('../attendanceClock.controller');

const TENANT = '507f1f77bcf86cd799439099';
const USER = '507f1f77bcf86cd799439011';
const EMP_A = '607f1f77bcf86cd7994390a1';

const OFFICE = [77.2295, 28.6129];
const northOf = ([lng, lat], metres) => [lng, lat + metres / 111320];

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const employee = {
  _id: EMP_A,
  fullName: 'Alice Smith',
  tenantId: TENANT,
  email: 'alice@example.com',
};

const officeDoc = (overrides = {}) => ({
  _id: 'office-1',
  name: 'Head office',
  geometry: { type: 'Point', coordinates: OFFICE },
  radiusMeters: 50,
  isActive: true,
  ...overrides,
});

/** A month document with a `save` that records what it was called with. */
const monthDoc = (days = []) => {
  const doc = {
    _id: 'attendance-1',
    employeeId: EMP_A,
    tenantId: TENANT,
    days,
    save: jest.fn().mockResolvedValue(undefined),
  };
  return doc;
};

let req;
let res;
let next;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2026, 7, 12, 9, 0, 0));

  req = {
    userId: USER,
    tenantId: TENANT,
    user: { email: 'alice@example.com' },
    params: {},
    query: {},
    body: { longitude: OFFICE[0], latitude: OFFICE[1] },
  };
  res = makeRes();
  next = jest.fn();

  Employee.findOne = jest.fn(() => ({
    lean: jest.fn().mockResolvedValue(employee),
  }));
  PayrollUpdate.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue(null),
  });
  Attendance.findOne = jest.fn().mockResolvedValue(null);
  OfficeLocation.find = jest.fn(() => ({
    lean: jest.fn().mockResolvedValue([officeDoc()]),
  }));
  OfficeLocation.create = jest.fn(async (doc) => ({ _id: 'office-1', ...doc }));
  OfficeLocation.findOneAndUpdate = jest.fn().mockResolvedValue(officeDoc());
});

afterEach(() => {
  jest.useRealTimers();
});

describe('clocking in', () => {
  it('creates the month, the day and the first session', async () => {
    // Attendance.findOne returns null, so the handler constructs a document.
    const saved = [];
    Attendance.mockImplementation(function (doc) {
      Object.assign(this, doc);
      this.save = jest.fn().mockResolvedValue(undefined);
      saved.push(this);
    });

    await clockIn(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);

    const [doc] = saved;
    expect(doc.days).toHaveLength(1);
    expect(doc.days[0].day).toBe(12);
    expect(doc.days[0].status).toBe('present');
    expect(doc.days[0].sessions).toHaveLength(1);
    expect(doc.days[0].sessions[0].clockOut).toBeNull();
  });

  it('records a punch inside the fence as ordinary attendance', async () => {
    const doc = monthDoc();
    Attendance.findOne.mockResolvedValue(doc);
    req.body = { coordinates: northOf(OFFICE, 20) };

    await clockIn(req, res, next);

    const payload = res.json.mock.calls[0][0];

    expect(payload.isFieldDuty).toBe(false);
    expect(payload.distanceFromOffice).toBe(20);
    expect(payload.officeLocation).toMatchObject({ name: 'Head office' });
  });

  it('records a punch outside every fence as field duty, and still records it', async () => {
    // Refusing the punch would leave the employee with no attendance record at
    // all, which is worse than an attributable out-of-fence one.
    const doc = monthDoc();
    Attendance.findOne.mockResolvedValue(doc);
    req.body = { coordinates: northOf(OFFICE, 300) };

    await clockIn(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      isFieldDuty: true,
      distanceFromOffice: 300,
    });
    expect(doc.save).toHaveBeenCalled();
  });

  it('is not field duty when the company has configured no offices', async () => {
    OfficeLocation.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    const doc = monthDoc();
    Attendance.findOne.mockResolvedValue(doc);

    await clockIn(req, res, next);

    // There is no fence to be outside of.
    expect(res.json.mock.calls[0][0].isFieldDuty).toBe(false);
  });

  it('appends a second session to a day that already has one', async () => {
    const doc = monthDoc([
      {
        day: 12,
        status: 'present',
        sessions: [
          {
            clockIn: new Date(2026, 7, 12, 6, 0),
            clockOut: new Date(2026, 7, 12, 8, 0),
          },
        ],
      },
    ]);
    Attendance.findOne.mockResolvedValue(doc);

    await clockIn(req, res, next);

    expect(doc.days[0].sessions).toHaveLength(2);
  });

  it('refuses a second clock-in while one is still open', async () => {
    const doc = monthDoc([
      {
        day: 12,
        status: 'present',
        sessions: [{ clockIn: new Date(2026, 7, 12, 8, 0), clockOut: null }],
      },
    ]);
    Attendance.findOne.mockResolvedValue(doc);

    await clockIn(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('refuses a punch into a month whose payroll has been paid', async () => {
    PayrollUpdate.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'payroll-1' }),
    });

    await clockIn(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/locked/i);
  });

  it('flags a punch with no coordinates rather than pretending it had them', async () => {
    const doc = monthDoc();
    Attendance.findOne.mockResolvedValue(doc);
    req.body = {};

    await clockIn(req, res, next);

    expect(res.json.mock.calls[0][0].spoofingFlags).toEqual(['no_coordinates']);
  });

  it('flags travel nobody could have made since the last punch', async () => {
    const doc = monthDoc([
      {
        day: 11,
        status: 'present',
        sessions: [
          {
            clockIn: new Date(2026, 7, 12, 8, 59),
            clockOut: new Date(2026, 7, 12, 8, 59),
            coordinates: {
              type: 'Point',
              coordinates: northOf(OFFICE, 100000),
            },
          },
        ],
      },
    ]);
    Attendance.findOne.mockResolvedValue(doc);

    await clockIn(req, res, next);

    expect(res.json.mock.calls[0][0].spoofingFlags).toContain(
      'impossible_speed',
    );
  });

  it('reads the employee scoped by tenant', async () => {
    await clockIn(req, res, next);

    expect(Employee.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT }),
    );
  });
});

describe('clocking out', () => {
  it('closes the open session and reports the time worked', async () => {
    const doc = monthDoc([
      {
        day: 12,
        status: 'present',
        sessions: [{ clockIn: new Date(2026, 7, 12, 8, 0), clockOut: null }],
      },
    ]);
    Attendance.findOne.mockResolvedValue(doc);

    await clockOut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.days[0].sessions[0].clockOut).toBeInstanceOf(Date);
    expect(res.json.mock.calls[0][0].workedMinutes).toBe(60);
    expect(doc.save).toHaveBeenCalled();
  });

  it('refuses when nothing is open', async () => {
    // 200 here would let a broken client believe it had recorded something.
    Attendance.findOne.mockResolvedValue(monthDoc([]));

    await clockOut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('refuses when the month has never been recorded', async () => {
    Attendance.findOne.mockResolvedValue(null);

    await clockOut(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('clock status', () => {
  it('reports an open session and the day’s total', async () => {
    Attendance.findOne.mockResolvedValue(
      monthDoc([
        {
          day: 12,
          status: 'present',
          sessions: [
            {
              clockIn: new Date(2026, 7, 12, 6, 0),
              clockOut: new Date(2026, 7, 12, 8, 0),
            },
            { clockIn: new Date(2026, 7, 12, 8, 30), clockOut: null },
          ],
        },
      ]),
    );

    await getClockStatus(req, res, next);

    expect(res.json.mock.calls[0][0]).toMatchObject({
      isClockedIn: true,
      sessionCount: 2,
      workedMinutes: 120,
    });
  });

  it('reports not clocked in for a month with no rows', async () => {
    Attendance.findOne.mockResolvedValue(null);

    await getClockStatus(req, res, next);

    expect(res.json.mock.calls[0][0]).toMatchObject({
      isClockedIn: false,
      sessionCount: 0,
      workedMinutes: 0,
    });
  });
});

describe('office locations', () => {
  it('rejects a Point with a swapped or malformed coordinate', async () => {
    req.body = {
      name: 'Head office',
      geometry: { type: 'Point', coordinates: [28.6129, 100] },
    };

    await createOfficeLocation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(OfficeLocation.create).not.toHaveBeenCalled();
  });

  it('rejects a Polygon whose ring is not closed enough to be a shape', async () => {
    req.body = {
      name: 'Campus',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.2, 28.6],
            [77.3, 28.6],
          ],
        ],
      },
    };

    await createOfficeLocation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a valid Point office against the caller’s tenant', async () => {
    req.body = {
      name: 'Head office',
      geometry: { type: 'Point', coordinates: OFFICE },
      radiusMeters: 75,
    };

    await createOfficeLocation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(OfficeLocation.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, createdBy: USER }),
    );
  });

  it('will not edit another company’s fence', async () => {
    OfficeLocation.findOneAndUpdate.mockResolvedValue(null);
    req.params = { id: new mongoose.Types.ObjectId().toString() };
    req.body = { name: 'Renamed' };

    await updateOfficeLocation(req, res, next);

    expect(OfficeLocation.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT }),
      expect.anything(),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
