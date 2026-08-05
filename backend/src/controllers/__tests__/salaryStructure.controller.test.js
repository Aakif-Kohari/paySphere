const mongoose = require('mongoose');
const {
  getSalaryStructure,
  getSalaryHistory,
  createSalaryRevision,
  previewSalaryStructure,
} = require('../salaryStructure.controller');

const SalaryStructure = require('../../models/salaryStructure.model');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const eventBus = require('../../services/event.service');
const { buildDefaultStructure } = require('../../utils/salaryStructure');

jest.mock('../../models/salaryStructure.model');
jest.mock('../../models/employee.model');
jest.mock('../../models/payroll.model');
jest.mock('../../services/cache.service', () => ({
  invalidateAnalytics: jest.fn().mockResolvedValue(undefined),
}));

const cacheService = require('../../services/cache.service');

const OWNER = '507f1f77bcf86cd799439011';
// The company. A different id from OWNER on purpose: since #613 the scope is
// the tenant, not the account that created the row.
const TENANT = '507f1f77bcf86cd799439099';
const EMP_A = '607f1f77bcf86cd7994390a1';

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const sortMock = (data) => ({ sort: jest.fn().mockResolvedValue(data) });
const selectMock = (data) => ({ select: jest.fn().mockResolvedValue(data) });

const employeeDoc = (overrides = {}) => ({
  _id: oid(EMP_A),
  fullName: 'Alice Smith',
  monthlySalary: 30000,
  createdBy: oid(OWNER),
  tenantId: oid(TENANT),
  joiningDate: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

const revisionDoc = (effectiveFrom, grossMonthly, overrides = {}) => ({
  _id: oid('707f1f77bcf86cd7994390b1'),
  employeeId: oid(EMP_A),
  createdBy: oid(OWNER),
  tenantId: oid(TENANT),
  effectiveFrom: new Date(effectiveFrom),
  grossMonthly,
  ctcAnnual: grossMonthly * 12,
  reason: 'revision',
  note: '',
  createdAt: new Date(effectiveFrom),
  ...buildDefaultStructure(grossMonthly),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  Employee.findOne.mockResolvedValue(employeeDoc());
  Employee.updateOne.mockResolvedValue({});
  SalaryStructure.find.mockImplementation(() => sortMock([]));
  SalaryStructure.updateOne.mockResolvedValue({});
  SalaryStructure.create.mockImplementation((doc) =>
    Promise.resolve({ _id: oid('707f1f77bcf86cd7994390b2'), ...doc }),
  );
  PayrollUpdate.findOne.mockImplementation(() => selectMock(null));
});

describe('getSalaryStructure — ownership and synthesis (#461)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { userId: OWNER, tenantId: TENANT, params: { id: EMP_A }, query: {} };
    res = makeRes();
    next = jest.fn();
  });

  test('scopes the employee lookup by tenant', async () => {
    await getSalaryStructure(req, res, next);

    expect(Employee.findOne).toHaveBeenCalledWith({
      _id: EMP_A,
      tenantId: TENANT,
    });
  });

  test("another company's employee is a 404", async () => {
    Employee.findOne.mockResolvedValue(null);

    await getSalaryStructure(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rejects a malformed id before querying', async () => {
    req.params.id = 'nope';

    await getSalaryStructure(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Employee.findOne).not.toHaveBeenCalled();
  });

  test('synthesises a structure for an employee that predates the migration', async () => {
    // An un-backfilled employee must still resolve to something payroll can
    // use, rather than returning nothing.
    SalaryStructure.find.mockImplementation(() => sortMock([]));

    await getSalaryStructure(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.isSynthesised).toBe(true);
    expect(payload.breakdown.totalEarnings).toBe(30000);
  });

  test('returns the stored revision when one exists', async () => {
    SalaryStructure.find.mockImplementation(() =>
      sortMock([revisionDoc('2026-01-01', 36000)]),
    );

    await getSalaryStructure(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.isSynthesised).toBe(false);
    expect(payload.structure.grossMonthly).toBe(36000);
    expect(payload.revisionCount).toBe(1);
  });

  test('a period query answers what the employee was on in a past month', async () => {
    // The question the single mutable field made unanswerable.
    SalaryStructure.find.mockImplementation(() =>
      sortMock([revisionDoc('2026-01-01', 30000), revisionDoc('2026-06-01', 45000)]),
    );
    req.query = { month: '3', year: '2026' };

    await getSalaryStructure(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.effectiveGross).toBe(30000);
    expect(payload.segments).toHaveLength(1);
  });

  test('a period query reports both rates when a raise lands mid-month', async () => {
    SalaryStructure.find.mockImplementation(() =>
      sortMock([revisionDoc('2026-01-01', 31000), revisionDoc('2026-07-16', 62000)]),
    );
    req.query = { month: '7', year: '2026' };

    await getSalaryStructure(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.segments).toHaveLength(2);
    expect(payload.segments[0].days).toBe(15);
    expect(payload.segments[1].days).toBe(16);
  });

  test('rejects an invalid period', async () => {
    for (const query of [{ month: '13', year: '2026' }, { month: '5', year: '1990' }]) {
      jest.clearAllMocks();
      Employee.findOne.mockResolvedValue(employeeDoc());
      SalaryStructure.find.mockImplementation(() => sortMock([]));
      req.query = query;
      await getSalaryStructure(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });
});

describe('getSalaryHistory — the timeline (#461)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { userId: OWNER, tenantId: TENANT, params: { id: EMP_A } };
    res = makeRes();
    next = jest.fn();
  });

  test('returns each revision with its diff against the previous one', async () => {
    SalaryStructure.find.mockImplementation(() =>
      sortMock([
        revisionDoc('2026-01-01', 30000),
        revisionDoc('2026-07-01', 36000),
      ]),
    );

    await getSalaryHistory(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.timeline).toHaveLength(2);
    // The first revision has nothing to compare against.
    expect(payload.timeline[0].diff).toBeNull();
    expect(payload.timeline[1].diff.grossDelta).toBe(6000);
    expect(payload.timeline[1].diff.percentChange).toBe(20);
  });

  test('an empty history is not an error', async () => {
    SalaryStructure.find.mockImplementation(() => sortMock([]));

    await getSalaryHistory(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].timeline).toEqual([]);
  });

  test('scopes by tenant', async () => {
    SalaryStructure.find.mockImplementation(() => sortMock([]));

    await getSalaryHistory(req, res, next);

    expect(SalaryStructure.find).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT }),
    );
  });
});

describe('createSalaryRevision (#461)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      tenantId: TENANT,
      params: { id: EMP_A },
      body: { grossMonthly: 36000, effectiveFrom: '2026-07-01', reason: 'revision' },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('appends a revision and returns the diff', async () => {
    SalaryStructure.find.mockImplementation(() =>
      sortMock([revisionDoc('2026-01-01', 30000)]),
    );

    await createSalaryRevision(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(SalaryStructure.create).toHaveBeenCalled();

    const payload = res.json.mock.calls[0][0];
    expect(payload.diff.grossFrom).toBe(30000);
    expect(payload.diff.grossTo).toBe(36000);
  });

  test('generates a default component split when none is supplied', async () => {
    await createSalaryRevision(req, res, next);

    const created = SalaryStructure.create.mock.calls[0][0];
    expect(created.components.length).toBeGreaterThan(0);
    expect(created.ctcAnnual).toBe(432000);
  });

  test('keeps monthlySalary in step when the revision is already in force', async () => {
    // Backwards compatibility is a hard requirement: every existing consumer
    // reads monthlySalary and none of them should have to change.
    req.body.effectiveFrom = '2020-01-01';

    await createSalaryRevision(req, res, next);

    expect(Employee.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything(), tenantId: TENANT },
      { $set: { monthlySalary: 36000 } },
    );
    expect(cacheService.invalidateAnalytics).toHaveBeenCalledWith(OWNER);
  });

  test('a future-dated raise does not change today’s pay', async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    req.body.effectiveFrom = future.toISOString();

    await createSalaryRevision(req, res, next);

    expect(Employee.updateOne).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].appliedImmediately).toBe(false);
  });

  test('refuses to back-date into an already-paid period', async () => {
    // The payslip is out; changing its basis after the fact would make the
    // stored payroll row unreproducible.
    PayrollUpdate.findOne.mockImplementation(() =>
      selectMock({ month: 5, year: 2026 }),
    );

    await createSalaryRevision(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].conflictingPeriod).toEqual({
      month: 5,
      year: 2026,
    });
    expect(SalaryStructure.create).not.toHaveBeenCalled();
  });

  test('rejects an invalid gross with every reason listed', async () => {
    req.body.grossMonthly = -100;

    await createSalaryRevision(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors.length).toBeGreaterThan(0);
    expect(SalaryStructure.create).not.toHaveBeenCalled();
  });

  test('a duplicate effective date is a 409, not a 500', async () => {
    const duplicate = new Error('E11000 duplicate key');
    duplicate.code = 11000;
    SalaryStructure.create.mockRejectedValue(duplicate);

    await createSalaryRevision(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  test('supersedes the previous revision rather than deleting it', async () => {
    // Append-only is what makes the history tamper-evident.
    req.body.effectiveFrom = '2020-06-01';
    SalaryStructure.find.mockImplementation(() =>
      sortMock([revisionDoc('2019-01-01', 30000)]),
    );

    await createSalaryRevision(req, res, next);

    expect(SalaryStructure.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      { $set: { supersededAt: expect.any(Date) } },
    );
  });

  test('emits a SALARY_REVISION audit event carrying before and after', async () => {
    // EMPLOYEE_UPDATE records only the *names* of the changed fields.
    const emitSpy = jest.spyOn(eventBus, 'emit');
    SalaryStructure.find.mockImplementation(() =>
      sortMock([revisionDoc('2020-01-01', 30000)]),
    );
    req.body.effectiveFrom = '2020-06-01';

    await createSalaryRevision(req, res, next);

    const auditCall = emitSpy.mock.calls.find(
      ([event, payload]) =>
        event === 'AUDIT_LOG' && payload.action === 'SALARY_REVISION',
    );

    expect(auditCall).toBeDefined();
    expect(auditCall[1].details.grossFrom).toBe(30000);
    expect(auditCall[1].details.grossTo).toBe(36000);
    expect(auditCall[1].details.percentChange).toBe(20);
    emitSpy.mockRestore();
  });

  test("another company's employee cannot be revised", async () => {
    Employee.findOne.mockResolvedValue(null);

    await createSalaryRevision(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(SalaryStructure.create).not.toHaveBeenCalled();
  });
});

describe('previewSalaryStructure — writes nothing (#461)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      tenantId: TENANT,
      params: { id: EMP_A },
      body: { grossMonthly: 40000, effectiveFrom: '2026-08-01' },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('returns the breakdown and the delta without creating anything', async () => {
    await previewSalaryStructure(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);

    const payload = res.json.mock.calls[0][0];
    expect(payload.breakdown.totalEarnings).toBe(40000);
    // Against the employee's synthesised current package of 30000.
    expect(payload.diff.grossDelta).toBe(10000);

    expect(SalaryStructure.create).not.toHaveBeenCalled();
    expect(Employee.updateOne).not.toHaveBeenCalled();
  });

  test('reports invalid input without writing', async () => {
    req.body.grossMonthly = 0;

    await previewSalaryStructure(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(SalaryStructure.create).not.toHaveBeenCalled();
  });
});
