/**
 * GraphQL resolvers: scoped, and returning values rather than nulls (#795).
 *
 * Two classes of assertion here. The first is that no resolver can be made to
 * read outside the caller's tenant — the reason that is not obvious is that an
 * unscoped mongoose filter reads *everything*, so "forgot the filter" and
 * "deliberately read all customers" produce the same query.
 *
 * The second is that the fields resolve at all. The original type definitions
 * described `firstName`, `lastName`, `basicSalary`, `netPay` and `payPeriod`,
 * none of which exist on the models, so every one came back null — which is
 * probably why nobody noticed the first class of problem.
 */

const mongoose = require('mongoose');

jest.mock('../../models/employee.model');
// A factory, not an automock: on `main` payroll.model.js does not parse (#792),
// and this suite has no business depending on that.
jest.mock('../../models/payroll.model', () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
  collection: { name: 'payrollupdates' },
}));

const Employee = require('../../models/employee.model');
const Payroll = require('../../models/payroll.model');
const { resolvers, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } = require('../schema');

const TENANT = new mongoose.Types.ObjectId();
const OTHER_TENANT = new mongoose.Types.ObjectId();
const EMPLOYEE_ID = new mongoose.Types.ObjectId();

const context = { tenantId: TENANT, userId: 'u1' };

/** The chain the resolvers build: find().sort().skip().limit().lean() */
const chain = (rows) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(rows),
});

beforeEach(() => {
  jest.clearAllMocks();

  Employee.find = jest.fn().mockReturnValue(chain([]));
  Employee.aggregate = jest.fn().mockResolvedValue([]);
  Employee.collection = { name: 'employees' };
  Payroll.find.mockReturnValue(chain([]));
  Payroll.aggregate.mockResolvedValue([]);
});

describe('every query is scoped to the caller tenant (#795)', () => {
  it('employees', async () => {
    await resolvers.Query.employees({}, {}, context);

    expect(Employee.find.mock.calls[0][0]).toMatchObject({ tenantId: TENANT });
  });

  it('payrolls', async () => {
    await resolvers.Query.payrolls({}, {}, context);

    expect(Payroll.find.mock.calls[0][0]).toMatchObject({ tenantId: TENANT });
  });

  it('departments, on both halves of the aggregation', async () => {
    await resolvers.Query.departments({}, {}, context);

    expect(Employee.aggregate.mock.calls[0][0][0].$match).toMatchObject({
      tenantId: TENANT,
    });
    expect(Payroll.aggregate.mock.calls[0][0][0].$match).toMatchObject({
      tenantId: TENANT,
    });
  });

  it.each([
    ['employees', () => resolvers.Query.employees({}, {}, undefined)],
    ['payrolls', () => resolvers.Query.payrolls({}, {}, undefined)],
    ['departments', () => resolvers.Query.departments({}, {}, undefined)],
  ])('%s refuses a context with no tenant', async (_name, run) => {
    // The failure mode being guarded against is not an exception — it is a
    // successful query that returns every customer's rows.
    await expect(run()).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
  });

  it('cannot be widened by a query argument', async () => {
    // There is no `tenantId` argument in the schema, and the filter is built
    // from the context, so passing one through `department` or `status` cannot
    // reach the scope.
    await resolvers.Query.employees(
      {},
      { department: String(OTHER_TENANT), status: 'active' },
      context,
    );

    expect(String(Employee.find.mock.calls[0][0].tenantId)).toBe(
      String(TENANT),
    );
  });
});

describe('employees resolve to real fields (#795)', () => {
  it('maps fullName, not firstName/lastName', async () => {
    Employee.find.mockReturnValue(
      chain([
        {
          _id: EMPLOYEE_ID,
          fullName: 'Alice Smith',
          email: 'alice@example.com',
          department: 'Engineering',
          role: 'Senior Engineer',
          monthlySalary: 30000,
          isActive: true,
          joiningDate: new Date('2024-01-15T00:00:00.000Z'),
        },
      ]),
    );

    const [row] = await resolvers.Query.employees({}, {}, context);

    expect(row).toMatchObject({
      id: String(EMPLOYEE_ID),
      fullName: 'Alice Smith',
      email: 'alice@example.com',
      department: 'Engineering',
      designation: 'Senior Engineer',
      monthlySalary: 30000,
      status: 'active',
    });
    expect(row.joiningDate).toBe('2024-01-15T00:00:00.000Z');
  });

  it('derives status from the fields the model has', async () => {
    // `status: "active"` used to filter on a path that does not exist, so it
    // matched nothing and the field always came back null.
    Employee.find.mockReturnValue(
      chain([
        { _id: EMPLOYEE_ID, fullName: 'A', isActive: true },
        { _id: EMPLOYEE_ID, fullName: 'B', isActive: false },
        { _id: EMPLOYEE_ID, fullName: 'C', employmentStatus: 'exited' },
      ]),
    );

    const rows = await resolvers.Query.employees({}, {}, context);

    expect(rows.map((r) => r.status)).toEqual([
      'active',
      'inactive',
      'inactive',
    ]);
  });

  it('turns status: "active" into a filter the model understands', async () => {
    await resolvers.Query.employees({}, { status: 'active' }, context);

    expect(Employee.find.mock.calls[0][0]).toMatchObject({
      isActive: true,
      employmentStatus: { $ne: 'exited' },
    });
  });
});

describe('payrolls resolve to real fields (#795)', () => {
  it('maps baseSalary/netSalary and builds payPeriod from month and year', async () => {
    Payroll.find.mockReturnValue(
      chain([
        {
          _id: EMPLOYEE_ID,
          employeeId: EMPLOYEE_ID,
          employeeName: 'Alice Smith',
          baseSalary: 30000,
          netSalary: 28500,
          bonus: 1000,
          deductions: 500,
          reimbursements: 250,
          status: 'approved',
          month: 3,
          year: 2026,
        },
      ]),
    );

    const [row] = await resolvers.Query.payrolls({}, {}, context);

    expect(row).toMatchObject({
      baseSalary: 30000,
      netSalary: 28500,
      reimbursements: 250,
      month: 3,
      year: 2026,
      payPeriod: '2026-03',
    });
  });

  it('normalises a legacy status spelling before filtering', async () => {
    // Three generations of spelling exist on disk (#458); a query for
    // "APPROVED" has to find rows stored as "approved".
    await resolvers.Query.payrolls({}, { status: 'APPROVED' }, context);

    expect(Payroll.find.mock.calls[0][0].status).toBe('approved');
  });

  it('rejects a status that is not in the vocabulary', async () => {
    await expect(
      resolvers.Query.payrolls({}, { status: 'whenever' }, context),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
  });
});

describe('pagination (#795)', () => {
  it('applies a default page size', async () => {
    const q = chain([]);
    Employee.find.mockReturnValue(q);

    await resolvers.Query.employees({}, {}, context);

    expect(q.limit).toHaveBeenCalledWith(DEFAULT_PAGE_SIZE);
  });

  it('caps what a caller can ask for', async () => {
    // Unbounded `find()` on the two largest collections was one line to type.
    const q = chain([]);
    Payroll.find.mockReturnValue(q);

    await resolvers.Query.payrolls({}, { limit: 100000 }, context);

    expect(q.limit).toHaveBeenCalledWith(MAX_PAGE_SIZE);
  });

  it.each([0, -10, undefined, Number.NaN])(
    'falls back to the default for limit %p',
    async (limit) => {
      const q = chain([]);
      Employee.find.mockReturnValue(q);

      await resolvers.Query.employees({}, { limit }, context);

      expect(q.limit).toHaveBeenCalledWith(DEFAULT_PAGE_SIZE);
    },
  );

  it('never skips a negative number of rows', async () => {
    const q = chain([]);
    Employee.find.mockReturnValue(q);

    await resolvers.Query.employees({}, { offset: -5 }, context);

    expect(q.skip).toHaveBeenCalledWith(0);
  });
});

describe('departments actually computes totalPayroll (#795)', () => {
  it('sums net pay per department instead of returning zero', async () => {
    // The original initialised totalPayroll to 0, fetched every payroll row,
    // and never read them — so the one number this query exists for was always
    // 0.
    Employee.aggregate.mockResolvedValue([
      { _id: 'Engineering', employeeCount: 3 },
      { _id: 'Sales', employeeCount: 2 },
    ]);
    Payroll.aggregate.mockResolvedValue([
      { _id: 'Engineering', totalPayroll: 90000 },
      { _id: 'Sales', totalPayroll: 40000 },
    ]);

    const rows = await resolvers.Query.departments({}, {}, context);

    expect(rows).toEqual([
      { name: 'Engineering', employeeCount: 3, totalPayroll: 90000 },
      { name: 'Sales', employeeCount: 2, totalPayroll: 40000 },
    ]);
  });

  it('shows a department that exists but has not been paid this period', async () => {
    Employee.aggregate.mockResolvedValue([
      { _id: 'Engineering', employeeCount: 3 },
      { _id: 'Facilities', employeeCount: 1 },
    ]);
    Payroll.aggregate.mockResolvedValue([
      { _id: 'Engineering', totalPayroll: 90000 },
    ]);

    const rows = await resolvers.Query.departments({}, {}, context);

    expect(rows).toContainEqual({
      name: 'Facilities',
      employeeCount: 1,
      totalPayroll: 0,
    });
  });

  it('narrows the cost side to the requested period', async () => {
    await resolvers.Query.departments({}, { month: 3, year: 2026 }, context);

    expect(Payroll.aggregate.mock.calls[0][0][0].$match).toMatchObject({
      tenantId: TENANT,
      month: 3,
      year: 2026,
    });
  });

  it('excludes soft-deleted employees from headcount', async () => {
    await resolvers.Query.departments({}, {}, context);

    expect(Employee.aggregate.mock.calls[0][0][0].$match).toMatchObject({
      isDeleted: { $ne: true },
    });
  });
});
