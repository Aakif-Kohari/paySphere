/**
 * The GraphQL schema for reporting queries (#539), scoped and corrected (#795).
 *
 * Two separate problems with the original.
 *
 * It was unscoped. Every resolver called `Model.find(query)` with no
 * `tenantId`, on an endpoint mounted with no authentication, so an anonymous
 * request read every company's employees and payroll rows. The tenant now comes
 * from the request context (see context.js) and there is deliberately no
 * argument through which a caller can supply one.
 *
 * And most of it did not resolve. The type definitions described fields the
 * models do not have — `firstName`/`lastName` against an Employee whose field
 * is `fullName`, `basicSalary`/`netPay`/`payPeriod` against a payroll row that
 * stores `baseSalary`/`netSalary`/`month`+`year`. Every one of those came back
 * `null`, and `employees(status: "active")` filtered on a path that does not
 * exist, so it always matched nothing. That is very likely why nobody noticed
 * the first problem.
 */

const Employee = require('../models/employee.model');
const Payroll = require('../models/payroll.model');
const { GraphQLError } = require('graphql');
const { ALL_STATUSES, normalizeStatus } = require('../config/payrollStatus');

/**
 * The most rows one query may ask for.
 *
 * `find()` with no limit on the two largest collections in the product is a way
 * for one request to pull the entire database into memory, and a GraphQL
 * endpoint makes that a single line to type.
 */
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

const typeDefs = `#graphql
  "An employee, as the Employee model actually stores them."
  type Employee {
    id: ID!
    fullName: String
    email: String
    department: String
    designation: String
    "Whether the record is active. Derived from isActive/employmentStatus."
    status: String
    monthlySalary: Float
    joiningDate: String
  }

  "One month's payroll for one employee."
  type Payroll {
    id: ID!
    employeeId: ID
    employeeName: String
    baseSalary: Float
    netSalary: Float
    bonus: Float
    deductions: Float
    reimbursements: Float
    status: String
    month: Int
    year: Int
    "month and year rendered as YYYY-MM, for grouping and display."
    payPeriod: String
  }

  "Headcount and payroll cost for one department."
  type Department {
    name: String
    employeeCount: Int
    totalPayroll: Float
  }

  type Query {
    employees(
      department: String
      status: String
      limit: Int
      offset: Int
    ): [Employee]

    payrolls(
      status: String
      month: Int
      year: Int
      limit: Int
      offset: Int
    ): [Payroll]

    "Headcount per department, with the payroll cost for a given period."
    departments(month: Int, year: Int): [Department]
  }
`;

/**
 * Clamp a caller-supplied page size.
 *
 * @param {number|undefined} limit
 * @returns {number}
 */
function pageSize(limit) {
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

/**
 * Clamp a caller-supplied offset.
 *
 * @param {number|undefined} offset
 * @returns {number}
 */
function pageOffset(offset) {
  if (!Number.isFinite(offset) || offset < 0) return 0;
  return offset;
}

/**
 * The tenant for this request, or a refusal.
 *
 * Every resolver starts here. Reading `context.tenantId` inline would work too,
 * right up until someone adds a resolver and forgets — and the failure mode for
 * forgetting is not an error, it is every tenant's rows.
 *
 * @param {object} context
 * @returns {string}
 */
function scopeOf(context) {
  if (!context || !context.tenantId) {
    throw new GraphQLError('Request is not scoped to a company', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }

  return context.tenantId;
}

/**
 * "active" / "inactive" -> the fields the Employee model actually has.
 *
 * @param {string|undefined} status
 * @returns {object} filter fragment
 */
function employeeStatusFilter(status) {
  if (!status) return {};

  const normalized = String(status).toLowerCase();

  if (normalized === 'active') {
    return { isActive: true, employmentStatus: { $ne: 'exited' } };
  }

  if (normalized === 'inactive' || normalized === 'exited') {
    return { $or: [{ isActive: false }, { employmentStatus: 'exited' }] };
  }

  return { employmentStatus: normalized };
}

const resolvers = {
  Query: {
    employees: async (_, { department, status, limit, offset }, context) => {
      const tenantId = scopeOf(context);

      const query = {
        tenantId,
        ...employeeStatusFilter(status),
      };

      if (department) query.department = department;

      // `.lean()` because every field is mapped by hand below — hydrating a
      // full mongoose document per row buys nothing here.
      const employees = await Employee.find(query)
        .sort({ fullName: 1 })
        .skip(pageOffset(offset))
        .limit(pageSize(limit))
        .lean();

      return employees.map((emp) => ({
        id: String(emp._id),
        fullName: emp.fullName,
        email: emp.email,
        department: emp.department,
        designation: emp.role,
        status:
          emp.employmentStatus === 'exited' || emp.isActive === false
            ? 'inactive'
            : 'active',
        monthlySalary: emp.monthlySalary,
        joiningDate: emp.joiningDate ? emp.joiningDate.toISOString() : null,
      }));
    },

    payrolls: async (_, { status, month, year, limit, offset }, context) => {
      const tenantId = scopeOf(context);
      const query = { tenantId };

      if (status) {
        // The vocabulary has three historical spellings; normalize so a query
        // for "APPROVED" finds rows stored as "approved" (#458).
        const canonical = normalizeStatus(status) || status;

        if (!ALL_STATUSES.includes(canonical)) {
          throw new GraphQLError(`Unknown payroll status: ${status}`, {
            extensions: { code: 'BAD_USER_INPUT', http: { status: 400 } },
          });
        }

        query.status = canonical;
      }

      if (Number.isFinite(month)) query.month = month;
      if (Number.isFinite(year)) query.year = year;

      const payrolls = await Payroll.find(query)
        .sort({ year: -1, month: -1 })
        .skip(pageOffset(offset))
        .limit(pageSize(limit))
        .lean();

      return payrolls.map((pay) => ({
        id: String(pay._id),
        employeeId: pay.employeeId ? String(pay.employeeId) : null,
        employeeName: pay.employeeName,
        baseSalary: pay.baseSalary,
        netSalary: pay.netSalary,
        bonus: pay.bonus,
        deductions: pay.deductions,
        reimbursements: pay.reimbursements,
        status: pay.status,
        month: pay.month,
        year: pay.year,
        payPeriod:
          pay.year && pay.month
            ? `${pay.year}-${String(pay.month).padStart(2, '0')}`
            : null,
      }));
    },

    departments: async (_, { month, year }, context) => {
      const tenantId = scopeOf(context);

      // The original loaded every employee *and* every payroll row into the
      // process, counted headcount in a JS object, and returned `totalPayroll`
      // as the 0 it was initialised with — the payroll collection was fetched
      // and then never read. Both halves are aggregations, and the payroll one
      // is the number this query exists to produce.
      const headcount = await Employee.aggregate([
        { $match: { tenantId, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: { $ifNull: ['$department', 'General'] },
            employeeCount: { $sum: 1 },
          },
        },
      ]);

      const payrollMatch = { tenantId };
      if (Number.isFinite(month)) payrollMatch.month = month;
      if (Number.isFinite(year)) payrollMatch.year = year;

      const cost = await Payroll.aggregate([
        { $match: payrollMatch },
        {
          $lookup: {
            from: Employee.collection.name,
            localField: 'employeeId',
            foreignField: '_id',
            as: 'employee',
          },
        },
        { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$employee.department', 'General'] },
            totalPayroll: { $sum: '$netSalary' },
          },
        },
      ]);

      const totals = new Map(cost.map((row) => [row._id, row.totalPayroll]));

      // Driven by headcount rather than by cost, so a department that exists but
      // has not been paid this period still appears, with a zero.
      return headcount.map((row) => ({
        name: row._id,
        employeeCount: row.employeeCount,
        totalPayroll: totals.get(row._id) || 0,
      }));
    },
  },
};

module.exports = {
  typeDefs,
  resolvers,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
};
