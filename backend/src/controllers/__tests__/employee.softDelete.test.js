const mongoose = require('mongoose');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const { deleteEmployee, restoreEmployee } = require('../employee.controller');

jest.mock('../../models/employee.model');
jest.mock('../../models/payroll.model');
jest.mock('../../models/user.model');
jest.mock('../../services/audit.service', () => ({
  createAuditLog: jest.fn(),
}));
jest.mock('../../models/settlement.model', () => ({
  exists: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../services/cache.service', () => ({
  invalidateAnalytics: jest.fn().mockResolvedValue(undefined),
}));

const oid = () => new mongoose.Types.ObjectId().toString();

const USER = oid();
const OTHER_USER = oid();
const TENANT = oid();
const OTHER_TENANT = oid();
const EMPLOYEE_ID = oid();

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (overrides = {}) => ({
  params: { id: EMPLOYEE_ID },
  userId: USER,
  tenantId: TENANT,
  ...overrides,
});

const liveEmployee = (overrides = {}) => ({
  _id: EMPLOYEE_ID,
  fullName: 'Priya Sharma',
  role: 'Engineer',
  createdBy: USER,
  tenantId: TENANT,
  isActive: true,
  isDeleted: false,
  deletedAt: null,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const deletedEmployee = (overrides = {}) =>
  liveEmployee({
    isActive: false,
    isDeleted: true,
    deletedAt: new Date('2026-07-01'),
    ...overrides,
  });

/** `Employee.findOne(...).setOptions({ includeDeleted: true })` */
const findOneReturns = (doc) => {
  const setOptions = jest.fn().mockResolvedValue(doc);
  Employee.findOne.mockReturnValue({ setOptions });

  return setOptions;
};

beforeEach(() => {
  jest.clearAllMocks();
  PayrollUpdate.exists.mockResolvedValue(null);
});

/**
 * The soft-delete marker (#897).
 *
 * `softDelete.plugin.js` adds `isDeleted` and `deletedAt` and every one of its
 * query hooks tests `isDeleted`. `deleteEmployee` wrote `deletedAt` alone. So
 * there were two markers for one fact and only one was ever set, which is why
 * `GET /api/archive/employees` — which selects on `isDeleted: true` — returned
 * an empty list for every account in the product since the day it shipped.
 */

describe('deleteEmployee sets both markers (#897)', () => {
  test('marks the record deleted, not just timestamped', async () => {
    const employee = liveEmployee();
    Employee.findById.mockResolvedValue(employee);

    await deleteEmployee(makeReq(), makeRes());

    expect(employee.isDeleted).toBe(true);
    expect(employee.deletedAt).toBeInstanceOf(Date);
    expect(employee.save).toHaveBeenCalled();
  });

  test('still deactivates, as before', async () => {
    const employee = liveEmployee();
    Employee.findById.mockResolvedValue(employee);

    await deleteEmployee(makeReq(), makeRes());

    expect(employee.isActive).toBe(false);
  });

  test('the two markers are written together', async () => {
    // The property that matters going forward. They disagreed for the life of
    // the product, and a record where they disagree is a record that is deleted
    // according to one query and live according to the next.
    const employee = liveEmployee();
    Employee.findById.mockResolvedValue(employee);

    await deleteEmployee(makeReq(), makeRes());

    expect(Boolean(employee.isDeleted)).toBe(Boolean(employee.deletedAt));
  });

  test('an employee with paid payroll is still protected', async () => {
    // #345's guard runs before the markers are touched, so a refusal must not
    // half-delete the record.
    PayrollUpdate.exists.mockResolvedValue({ _id: oid() });
    const employee = liveEmployee();
    Employee.findById.mockResolvedValue(employee);
    const res = makeRes();

    await deleteEmployee(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(employee.isDeleted).toBe(false);
    expect(employee.save).not.toHaveBeenCalled();
  });
});

describe('restoreEmployee can find the record (#897)', () => {
  test('the lookup opts out of the soft-delete plugin', async () => {
    // Without this, restore is unreachable the moment delete starts setting
    // `isDeleted`: `findById` goes through the `findOne` hook, the hook appends
    // `isDeleted: { $ne: true }`, and the one record this endpoint exists to
    // load is the one record it cannot see. Every id would answer 404.
    const setOptions = findOneReturns(deletedEmployee());

    await restoreEmployee(makeReq(), makeRes());

    expect(Employee.findOne).toHaveBeenCalledWith({ _id: EMPLOYEE_ID });
    expect(setOptions).toHaveBeenCalledWith({ includeDeleted: true });
  });

  test('clears both markers', async () => {
    // Clearing `deletedAt` alone would leave `isDeleted: true` on a record the
    // UI now shows as restored — and every plugin hook would go on hiding it,
    // so the employee would vanish from the directory with nothing to explain
    // why.
    const employee = deletedEmployee();
    findOneReturns(employee);

    await restoreEmployee(makeReq(), makeRes());

    expect(employee.isDeleted).toBe(false);
    expect(employee.deletedAt).toBeNull();
    expect(employee.isActive).toBe(true);
    expect(employee.save).toHaveBeenCalled();
  });

  test('answers 200 with the restored record', async () => {
    findOneReturns(deletedEmployee());
    const res = makeRes();

    await restoreEmployee(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('a record that is not deleted is a 404', async () => {
    findOneReturns(liveEmployee());
    const res = makeRes();

    await restoreEmployee(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('a missing record is a 404', async () => {
    findOneReturns(null);
    const res = makeRes();

    await restoreEmployee(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('a malformed id is a 400 before any query', async () => {
    const res = makeRes();

    await restoreEmployee(makeReq({ params: { id: 'nope' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Employee.findOne).not.toHaveBeenCalled();
  });
});

describe('restoreEmployee scoping (#897)', () => {
  test('a colleague in the same company can restore', async () => {
    // The archive lists the company's deleted employees. A check on `createdBy`
    // here renders a restore button on every colleague's card and answers 403
    // to all of them — an inconsistency created by scoping the list correctly
    // and leaving the write alone.
    const employee = deletedEmployee({ createdBy: OTHER_USER });
    findOneReturns(employee);
    const res = makeRes();

    await restoreEmployee(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(employee.isDeleted).toBe(false);
  });

  test('another company record is refused', async () => {
    const employee = deletedEmployee({
      createdBy: OTHER_USER,
      tenantId: OTHER_TENANT,
    });
    findOneReturns(employee);
    const res = makeRes();

    await restoreEmployee(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(employee.save).not.toHaveBeenCalled();
  });

  test('the refusal is a 404, so ids cannot be probed', async () => {
    findOneReturns(deletedEmployee({ tenantId: OTHER_TENANT }));
    const res = makeRes();

    await restoreEmployee(makeReq(), res);

    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  test('a record predating tenants falls back to the creator check', async () => {
    // backfillTenants (#612) stamps `tenantId` onto existing rows, but a record
    // it has not reached must not become restorable by anyone.
    const employee = deletedEmployee({
      tenantId: undefined,
      createdBy: OTHER_USER,
    });
    findOneReturns(employee);
    const res = makeRes();

    await restoreEmployee(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('a record predating tenants is restorable by its creator', async () => {
    const employee = deletedEmployee({ tenantId: undefined, createdBy: USER });
    findOneReturns(employee);
    const res = makeRes();

    await restoreEmployee(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
