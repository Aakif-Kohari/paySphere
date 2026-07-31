const mongoose = require('mongoose');
const Employee = require('../../models/employee.model');
const SalaryStructure = require('../../models/salaryStructure.model');
const {
  backfillSalaryStructures,
  findUnmigratedEmployees,
  buildInitialRevision,
} = require('../backfillSalaryStructures');
const { computeComponentAmounts } = require('../../utils/salaryStructure');

jest.mock('../../models/employee.model');
jest.mock('../../models/salaryStructure.model');

const oid = (hex) => new mongoose.Types.ObjectId(hex);
const OWNER = oid('507f1f77bcf86cd799439011');

const employeeDoc = (overrides = {}) => ({
  _id: oid('607f1f77bcf86cd7994390a1'),
  createdBy: OWNER,
  monthlySalary: 30000,
  fullName: 'Alice Smith',
  joiningDate: new Date('2024-03-15'),
  createdAt: new Date('2024-03-01'),
  ...overrides,
});

const queryChain = (data) => ({
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockResolvedValue(data),
});

beforeEach(() => {
  jest.clearAllMocks();
  SalaryStructure.distinct.mockResolvedValue([]);
  SalaryStructure.syncIndexes.mockResolvedValue([]);
  SalaryStructure.insertMany.mockImplementation((docs) => Promise.resolve(docs));
  Employee.find.mockImplementation(() => queryChain([]));
});

describe('backfillSalaryStructures — buildInitialRevision (#461)', () => {
  test('the generated split reconstitutes to exactly the stored salary', () => {
    // Non-negotiable: a migration that changed anyone's pay would be far worse
    // than no migration at all.
    [30000, 12345, 999.99, 7777.77, 1, 100000].forEach((monthlySalary) => {
      const revision = buildInitialRevision(employeeDoc({ monthlySalary }));
      const resolved = computeComponentAmounts(revision);

      expect(resolved.totalEarnings).toBe(Math.round(monthlySalary * 100) / 100);
      expect(revision.grossMonthly).toBe(Math.round(monthlySalary * 100) / 100);
    });
  });

  test('marks the revision as initial and derives the annual CTC', () => {
    const revision = buildInitialRevision(employeeDoc());

    expect(revision.reason).toBe('initial');
    expect(revision.ctcAnnual).toBe(360000);
  });

  test('dates from the joining date so a past-period query resolves', () => {
    const revision = buildInitialRevision(employeeDoc());
    expect(revision.effectiveFrom).toEqual(new Date('2024-03-15'));
  });

  test('falls back to createdAt when no joining date is recorded', () => {
    const revision = buildInitialRevision(
      employeeDoc({ joiningDate: undefined }),
    );
    expect(revision.effectiveFrom).toEqual(new Date('2024-03-01'));
  });

  test('carries the owning account through, so the revision stays scoped', () => {
    const revision = buildInitialRevision(employeeDoc());
    expect(revision.createdBy).toBe(OWNER);
  });

  test('skips an employee with no usable salary', () => {
    [0, -100, null, undefined, NaN].forEach((monthlySalary) => {
      expect(buildInitialRevision(employeeDoc({ monthlySalary }))).toBeNull();
    });
  });
});

describe('backfillSalaryStructures — selection', () => {
  test('excludes employees that already have a revision', async () => {
    const migrated = [oid('607f1f77bcf86cd7994390a9')];
    SalaryStructure.distinct.mockResolvedValue(migrated);

    await findUnmigratedEmployees(10);

    const filter = Employee.find.mock.calls[0][0];
    expect(filter._id.$nin).toBe(migrated);
    expect(filter.monthlySalary).toEqual({ $gt: 0 });
  });
});

describe('backfillSalaryStructures — run', () => {
  test('creates one revision per unmigrated employee', async () => {
    Employee.find.mockImplementationOnce(() =>
      queryChain([employeeDoc(), employeeDoc({ _id: oid('607f1f77bcf86cd7994390a2') })]),
    );

    const result = await backfillSalaryStructures();

    expect(result.ok).toBe(true);
    expect(result.created).toBe(2);
    expect(SalaryStructure.insertMany).toHaveBeenCalled();
  });

  test('is idempotent — a fully migrated database is a no-op', async () => {
    Employee.find.mockImplementation(() => queryChain([]));

    const result = await backfillSalaryStructures();

    expect(result.ok).toBe(true);
    expect(result.created).toBe(0);
    expect(SalaryStructure.insertMany).not.toHaveBeenCalled();
  });

  test('counts an employee with an unusable salary as skipped, not failed', async () => {
    Employee.find.mockImplementationOnce(() =>
      queryChain([employeeDoc({ monthlySalary: 0 })]),
    );

    const result = await backfillSalaryStructures();

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
  });

  test('treats a concurrent duplicate as work already done, not a failure', async () => {
    Employee.find.mockImplementationOnce(() => queryChain([employeeDoc()]));

    const duplicate = new Error('E11000');
    duplicate.code = 11000;
    duplicate.insertedDocs = [];
    duplicate.writeErrors = [{}];
    SalaryStructure.insertMany.mockRejectedValue(duplicate);

    const result = await backfillSalaryStructures();

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(1);
  });

  test('rebuilds the indexes', async () => {
    await backfillSalaryStructures();
    expect(SalaryStructure.syncIndexes).toHaveBeenCalled();
  });

  test('never throws — a failed migration must not take the boot down', async () => {
    SalaryStructure.distinct.mockRejectedValue(new Error('connection lost'));

    const result = await backfillSalaryStructures();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('connection lost');
    expect(result.created).toBe(0);
  });
});
