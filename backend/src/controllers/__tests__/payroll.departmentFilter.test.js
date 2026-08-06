jest.mock('../../models/employee.model');
jest.mock('../../models/payroll.model');
jest.mock('../../models/user.model');
jest.mock('../../models/attendance.model', () => ({
  find: jest.fn(() => ({ select: jest.fn().mockResolvedValue([]) })),
}));
jest.mock('../../models/loan.model', () => ({
  find: jest.fn().mockResolvedValue([]),
  updateOne: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../models/salaryStructure.model', () => ({
  find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([]) })),
}));
jest.mock('../../services/audit.service', () => ({
  createAuditLog: jest.fn(),
}));
jest.mock('../../services/cache.service', () => ({
  invalidateAnalytics: jest.fn(),
  invalidateDashboardSummary: jest.fn(),
}));

const mongoose = require('mongoose');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const { getPayrollSummary } = require('../payroll.controller');

const TENANT_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();
const ENGINEER_ID = new mongoose.Types.ObjectId();

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildReq = (query = {}, overrides = {}) => ({
  userId: USER_ID,
  tenantId: TENANT_ID,
  query: { month: 8, year: 2026, ...query },
  ...overrides,
});

/** A find() whose result is reachable both by await and by .sort().skip().limit(). */
const findResult = (rows) => {
  const chain = {
    sort: jest.fn(() => chain),
    skip: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
    catch: (reject) => Promise.resolve(rows).catch(reject),
  };
  return chain;
};

/** Employee.find(...).select(...).lean() */
const employeeLookup = (rows) => {
  Employee.find.mockReturnValue({
    select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(rows) })),
  });
};

beforeEach(() => {
  jest.clearAllMocks();

  employeeLookup([]);
  PayrollUpdate.find.mockReturnValue(findResult([]));
  PayrollUpdate.countDocuments.mockResolvedValue(0);
  PayrollUpdate.aggregate.mockResolvedValue([]);
});

describe('getPayrollSummary — department filter (#665)', () => {
  test('a request with no departments does not filter by employee', async () => {
    const res = buildRes();

    await getPayrollSummary(buildReq(), res, jest.fn());

    expect(Employee.find).not.toHaveBeenCalled();
    expect(PayrollUpdate.countDocuments.mock.calls[0][0].employeeId).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('a department filter no longer throws — the reported 500', async () => {
    // Was: `employeeIds.map(id => require('mongoose').Types.ObjectId(id))`,
    // which throws "Class constructor ObjectId cannot be invoked without 'new'"
    // on Mongoose 6+. This project runs 9.9, so every filtered request was a
    // 500 with no explanation.
    employeeLookup([{ _id: ENGINEER_ID }]);

    const res = buildRes();
    const next = jest.fn();

    await getPayrollSummary(buildReq({ departments: 'Engineering' }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('the filter reaches the query as cast ObjectIds', async () => {
    employeeLookup([{ _id: ENGINEER_ID }]);

    await getPayrollSummary(
      buildReq({ departments: 'Engineering' }),
      buildRes(),
      jest.fn(),
    );

    const filter = PayrollUpdate.countDocuments.mock.calls[0][0];
    expect(filter.employeeId.$in).toHaveLength(1);
    expect(filter.employeeId.$in[0]).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(filter.employeeId.$in[0].toString()).toBe(ENGINEER_ID.toString());
  });

  test('the employee lookup is scoped by tenant, not by createdBy', async () => {
    await getPayrollSummary(
      buildReq({ departments: 'Engineering' }),
      buildRes(),
      jest.fn(),
    );

    const [lookup] = Employee.find.mock.calls[0];
    expect(lookup.tenantId).toBe(TENANT_ID);
    expect(lookup.createdBy).toBeUndefined();
  });

  test('a department nobody belongs to returns nothing, not the whole month', async () => {
    // The silent half of the bug. `createdBy` stopped being written in #585, so
    // the lookup returned [], the `if (employeeIds.length > 0)` guard was
    // skipped, and the response contained every employee's payroll.
    employeeLookup([]);

    await getPayrollSummary(
      buildReq({ departments: 'Nonexistent' }),
      buildRes(),
      jest.fn(),
    );

    expect(PayrollUpdate.countDocuments.mock.calls[0][0].employeeId).toEqual({
      $in: [],
    });
  });

  test('the page, the count and the totals all use the same filter', async () => {
    employeeLookup([{ _id: ENGINEER_ID }]);

    await getPayrollSummary(
      buildReq({ departments: 'Engineering' }),
      buildRes(),
      jest.fn(),
    );

    const countFilter = PayrollUpdate.countDocuments.mock.calls[0][0];
    const findFilter = PayrollUpdate.find.mock.calls[0][0];
    const [{ $match: aggFilter }] = PayrollUpdate.aggregate.mock.calls[0][0];

    expect(findFilter).toBe(countFilter);
    expect(aggFilter).toBe(countFilter);
  });

  test('multiple departments are parsed, trimmed and de-duplicated', async () => {
    await getPayrollSummary(
      buildReq({ departments: ' Engineering , Sales ,Engineering, ' }),
      buildRes(),
      jest.fn(),
    );

    expect(Employee.find.mock.calls[0][0].$or).toEqual([
      { department: { $in: ['Engineering', 'Sales'] } },
      { role: { $in: ['Engineering', 'Sales'] } },
    ]);
  });

  test('the applied departments come back in the response', async () => {
    const res = buildRes();

    await getPayrollSummary(buildReq({ departments: 'Sales' }), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ departments: ['Sales'] }),
    );
  });

  test('a request with no tenant is refused rather than run unscoped', async () => {
    const next = jest.fn();

    await getPayrollSummary(
      buildReq({}, { tenantId: undefined }),
      buildRes(),
      next,
    );

    expect(PayrollUpdate.countDocuments).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MissingTenantError' }),
    );
  });

  test('month and year are still validated before any of this', async () => {
    const res = buildRes();

    await getPayrollSummary(
      buildReq({ month: 13, departments: 'Sales' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Employee.find).not.toHaveBeenCalled();
  });
});
