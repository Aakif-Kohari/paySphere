const mongoose = require('mongoose');
const {
  parseDepartments,
  toObjectIds,
  resolveDepartmentEmployeeIds,
  applyEmployeeFilter,
} = require('../departmentFilter');

const TENANT_ID = new mongoose.Types.ObjectId().toString();

const employeeModel = (rows) => ({
  find: jest.fn(() => ({
    select: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(rows),
    })),
  })),
});

describe('parseDepartments (#665)', () => {
  test('splits a comma-separated list', () => {
    expect(parseDepartments('Engineering,Sales')).toEqual([
      'Engineering',
      'Sales',
    ]);
  });

  test('trims and drops empties', () => {
    expect(parseDepartments(' Engineering , , Sales ,')).toEqual([
      'Engineering',
      'Sales',
    ]);
  });

  test('de-duplicates', () => {
    expect(parseDepartments('Sales,Sales')).toEqual(['Sales']);
  });

  test('returns an empty list for anything that is not a non-empty string', () => {
    for (const value of [undefined, null, '', '   ', 42, ['Sales'], {}]) {
      expect(parseDepartments(value)).toEqual([]);
    }
  });
});

describe('toObjectIds (#665)', () => {
  test('casts valid ids', () => {
    const id = new mongoose.Types.ObjectId();

    const cast = toObjectIds([id.toString()]);

    expect(cast).toHaveLength(1);
    expect(cast[0]).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(cast[0].toString()).toBe(id.toString());
  });

  test('does not throw on Mongoose 9 — the reported crash', () => {
    // `mongoose.Types.ObjectId(id)` without `new` throws
    // "Class constructor ObjectId cannot be invoked without 'new'" on every
    // version from 6 up. This project is on 9.9.
    expect(() =>
      mongoose.Types.ObjectId(new mongoose.Types.ObjectId().toString()),
    ).toThrow(/without 'new'/);

    expect(() =>
      toObjectIds([new mongoose.Types.ObjectId().toString()]),
    ).not.toThrow();
  });

  test('skips unusable ids rather than throwing a CastError', () => {
    const good = new mongoose.Types.ObjectId().toString();

    expect(toObjectIds([good, 'not-an-id', null, undefined, ''])).toHaveLength(
      1,
    );
  });

  test('handles an empty or missing list', () => {
    expect(toObjectIds([])).toEqual([]);
    expect(toObjectIds(undefined)).toEqual([]);
  });
});

describe('resolveDepartmentEmployeeIds (#665)', () => {
  test('returns null when no departments were requested — do not filter', async () => {
    const Employee = employeeModel([]);

    await expect(
      resolveDepartmentEmployeeIds(Employee, TENANT_ID, []),
    ).resolves.toBeNull();
    expect(Employee.find).not.toHaveBeenCalled();
  });

  test('scopes the lookup by tenant, not by createdBy', async () => {
    // The second half of the bug: #585 stopped writing `createdBy`, so the old
    // lookup found nothing for any employee added since, the length guard was
    // skipped, and the filter was silently dropped.
    const Employee = employeeModel([]);

    await resolveDepartmentEmployeeIds(Employee, TENANT_ID, ['Engineering']);

    const [filter] = Employee.find.mock.calls[0];
    expect(filter.tenantId).toBe(TENANT_ID);
    expect(filter.createdBy).toBeUndefined();
    expect(filter.deletedAt).toBeNull();
  });

  test('matches on department or role', async () => {
    const Employee = employeeModel([]);

    await resolveDepartmentEmployeeIds(Employee, TENANT_ID, ['Sales']);

    expect(Employee.find.mock.calls[0][0].$or).toEqual([
      { department: { $in: ['Sales'] } },
      { role: { $in: ['Sales'] } },
    ]);
  });

  test('returns cast ObjectIds', async () => {
    const id = new mongoose.Types.ObjectId();
    const Employee = employeeModel([{ _id: id }]);

    const ids = await resolveDepartmentEmployeeIds(Employee, TENANT_ID, [
      'Sales',
    ]);

    expect(ids).toHaveLength(1);
    expect(ids[0]).toBeInstanceOf(mongoose.Types.ObjectId);
  });

  test('returns an empty array — not null — when nobody matches', async () => {
    // The distinction that matters: [] narrows to nothing, null means "no
    // filter". Conflating them is what returned the whole month.
    const Employee = employeeModel([]);

    await expect(
      resolveDepartmentEmployeeIds(Employee, TENANT_ID, ['Nonexistent']),
    ).resolves.toEqual([]);
  });
});

describe('applyEmployeeFilter (#665)', () => {
  test('leaves the query alone when no filter was requested', () => {
    const query = { tenantId: TENANT_ID, month: 8 };

    applyEmployeeFilter(query, null);

    expect(query).toEqual({ tenantId: TENANT_ID, month: 8 });
  });

  test('narrows to nothing when a filter matched nobody', () => {
    const query = { tenantId: TENANT_ID };

    applyEmployeeFilter(query, []);

    expect(query.employeeId).toEqual({ $in: [] });
  });

  test('applies the ids', () => {
    const ids = [new mongoose.Types.ObjectId()];
    const query = {};

    applyEmployeeFilter(query, ids);

    expect(query.employeeId).toEqual({ $in: ids });
  });

  test('can target another path', () => {
    const ids = [new mongoose.Types.ObjectId()];
    const query = {};

    applyEmployeeFilter(query, ids, '_id');

    expect(query._id).toEqual({ $in: ids });
    expect(query.employeeId).toBeUndefined();
  });
});
