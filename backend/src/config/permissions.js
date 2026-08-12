/**
 * Canonical RBAC vocabulary for PaySphere.
 *
 * Both the seeder and the route definitions read from this file so the set of
 * permission names can never drift between "what gets written to the database"
 * and "what the routes ask for" — a mismatch there is invisible until a user
 * hits a 403 they should not have hit.
 */

// --- Permissions -----------------------------------------------------------

const PERMISSIONS = {
  READ_EMPLOYEE: 'READ_EMPLOYEE',
  WRITE_EMPLOYEE: 'WRITE_EMPLOYEE',
  DELETE_EMPLOYEE: 'DELETE_EMPLOYEE',
  READ_PAYROLL: 'READ_PAYROLL',
  WRITE_PAYROLL: 'WRITE_PAYROLL',
  // Maker–checker: the account that submits a payroll run should not be the
  // only thing standing between a figure and a bank transfer. Kept separate
  // from WRITE_PAYROLL so the two can be held by different people (#458).
  APPROVE_PAYROLL: 'APPROVE_PAYROLL',
  READ_REPORT: 'READ_REPORT',
  // Kept apart from READ_REPORT because they are not the same act. Viewing a
  // report is a read; standing up a recurring job that mails a payroll register
  // to an address of your choosing is a write, and a fairly serious one. Both
  // scheduler write routes were gated on READ_REPORT, which every role holds
  // including Employee — so anyone who could view a report could also schedule
  // an export of company salary data to an external mailbox, or delete another
  // admin's schedule (#666).
  MANAGE_REPORT_SCHEDULE: 'MANAGE_REPORT_SCHEDULE',
  // A webhook endpoint is a standing instruction to POST company payroll and
  // employee data to an external URL, signed with a secret this account owns.
  // Creating, editing, rotating the secret for or deleting one is a write that
  // can point data anywhere, so it is its own permission and it stays with the
  // owner role — deliberately not something every admin of the workspace can do
  // (#474).
  MANAGE_WEBHOOKS: 'MANAGE_WEBHOOKS',
  // Expense claims (#719). routes/expense.routes.js has asked for these since
  // it was written and none of them existed here, so the seeder never created
  // them, no role held them, and every expense endpoint answered 403 for every
  // account in the product — the owner included, because SUPER_ADMIN below is a
  // fixed list and not a wildcard (#794).
  READ_EXPENSE: 'READ_EXPENSE',
  WRITE_EXPENSE: 'WRITE_EXPENSE',
  // Kept apart from WRITE_EXPENSE for the same reason APPROVE_PAYROLL is kept
  // apart from WRITE_PAYROLL: whoever submits a claim for payment should not be
  // the only person standing between it and a bank transfer.
  APPROVE_EXPENSE: 'APPROVE_EXPENSE',
  // A category carries the `isTaxable` flag, which decides whether a claim is
  // paid as taxable earnings or as a tax-free reimbursement. That is a tax
  // decision rather than day-to-day expense admin, so it stays with the owner.
  MANAGE_EXPENSE_CATEGORY: 'MANAGE_EXPENSE_CATEGORY',
  // Statutory compliance (#933, reachable since #951). Deliberately not
  // READ_REPORT: a Form 16 is one person's complete tax position and a Form 24Q
  // export is every employee's PAN, salary and tax in one file, while
  // READ_REPORT is held by every role including Employee.
  // Declared here because `routes/role.routes.js` gates all four of its routes
  // on it and `PERMISSION_DEFINITIONS` below already has an entry for it — but
  // the name itself was never added to this object, so every one of those
  // routes called `requirePermission(undefined)` and the definition was written
  // to the database with `name: undefined`. Found while adding the compliance
  // permissions below, because the invariant tests in `permissions.expense.test`
  // and `rbac.seed.test` fail on it.
  MANAGE_ROLES: 'MANAGE_ROLES',
  READ_COMPLIANCE: 'READ_COMPLIANCE',
  // Writing the company's TAN, or marking a tax declaration verified, decides
  // what gets filed with the tax department under the employer's name. Kept
  // with the owner for the same reason MANAGE_EXPENSE_CATEGORY is.
  MANAGE_COMPLIANCE: 'MANAGE_COMPLIANCE',
};

const PERMISSION_DEFINITIONS = [
  {
    name: PERMISSIONS.READ_EMPLOYEE,
    description: 'View the employee directory and individual employee records',
  },
  {
    name: PERMISSIONS.WRITE_EMPLOYEE,
    description: 'Create and update employees, and import them from CSV',
  },
  {
    name: PERMISSIONS.DELETE_EMPLOYEE,
    description: 'Permanently delete an employee and their payroll history',
  },
  {
    name: PERMISSIONS.READ_PAYROLL,
    description: 'View payroll summaries and export payroll data',
  },
  {
    name: PERMISSIONS.WRITE_PAYROLL,
    description: 'Finalize payroll runs and dispatch payslip emails',
  },
  {
    name: PERMISSIONS.APPROVE_PAYROLL,
    description:
      'Approve or reject a submitted payroll run before it can be paid',
  },
  {
    name: PERMISSIONS.READ_REPORT,
    description: 'View analytics and download generated reports',
  },
  {
    name: PERMISSIONS.MANAGE_REPORT_SCHEDULE,
    description:
      'Create and delete recurring report schedules, which mail company data to their recipients',
  },
  {
    name: PERMISSIONS.MANAGE_WEBHOOKS,
    description:
      'Create, update and delete webhook endpoints, which receive company data when payroll or employee events fire',
  },
  {
    name: PERMISSIONS.READ_EXPENSE,
    description: 'View expense claims and the categories they are filed under',
  },
  {
    name: PERMISSIONS.WRITE_EXPENSE,
    description: 'Submit expense claims with receipts',
  },
  {
    name: PERMISSIONS.APPROVE_EXPENSE,
    description:
      'Approve or reject a submitted expense claim, which schedules it for reimbursement in the next payroll run',
  },
  {
    name: PERMISSIONS.MANAGE_EXPENSE_CATEGORY,
    description:
      'Create and edit expense categories, including whether a category is taxable',
  },
  {
    name: PERMISSIONS.READ_COMPLIANCE,
    description:
      'View compliance settings and download Form 16 certificates and Form 24Q returns',
  },
  {
    name: PERMISSIONS.MANAGE_COMPLIANCE,
    description:
      "Set the company's TAN and PAN and record or verify employee tax declarations",
  },
  {
    name: PERMISSIONS.MANAGE_ROLES,
    description:
      'Create, update and delete custom roles and their permission sets',
  },
];

// --- Roles -----------------------------------------------------------------

const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  HR_MANAGER: 'HRManager',
  EMPLOYEE: 'Employee',
};

/**
 * The role granted to an account at registration.
 *
 * In PaySphere the person who signs up *is* the business owner: there is no
 * invitation flow, and every query in every controller is already scoped by
 * `createdBy: req.userId`. An account therefore only ever reaches its own
 * company's data, so granting the owner role at signup is the correct default
 * rather than a privilege escalation.
 */
const DEFAULT_ROLE = ROLES.SUPER_ADMIN;

const ROLE_DEFINITIONS = [
  {
    name: ROLES.SUPER_ADMIN,
    permissions: [
      PERMISSIONS.READ_EMPLOYEE,
      PERMISSIONS.WRITE_EMPLOYEE,
      PERMISSIONS.DELETE_EMPLOYEE,
      PERMISSIONS.READ_PAYROLL,
      PERMISSIONS.WRITE_PAYROLL,
      PERMISSIONS.APPROVE_PAYROLL,
      PERMISSIONS.READ_REPORT,
      PERMISSIONS.MANAGE_REPORT_SCHEDULE,
      PERMISSIONS.MANAGE_WEBHOOKS,
      PERMISSIONS.READ_EXPENSE,
      PERMISSIONS.WRITE_EXPENSE,
      PERMISSIONS.APPROVE_EXPENSE,
      PERMISSIONS.MANAGE_EXPENSE_CATEGORY,
      PERMISSIONS.READ_COMPLIANCE,
      PERMISSIONS.MANAGE_COMPLIANCE,
      // Held by the owner alone: a role edit changes what every other account
      // in the company can do.
      PERMISSIONS.MANAGE_ROLES,
    ],
  },
  {
    name: ROLES.HR_MANAGER,
    // Can run payroll day to day, but cannot destroy an employee's history —
    // and deliberately cannot approve its own submissions. The HR manager is
    // the maker; the owner is the checker (#458).
    permissions: [
      PERMISSIONS.READ_EMPLOYEE,
      PERMISSIONS.WRITE_EMPLOYEE,
      PERMISSIONS.READ_PAYROLL,
      PERMISSIONS.WRITE_PAYROLL,
      PERMISSIONS.READ_REPORT,
      // Expenses are HR's day job: file them on an employee's behalf, and sign
      // off the ones that come in. Not MANAGE_EXPENSE_CATEGORY — `isTaxable`
      // decides how a claim is taxed, and that stays with the owner.
      PERMISSIONS.READ_EXPENSE,
      PERMISSIONS.WRITE_EXPENSE,
      PERMISSIONS.APPROVE_EXPENSE,
      // Issuing Form 16 at year end is HR's job. Setting the TAN the return is
      // filed under is not — that stays with the owner.
      PERMISSIONS.READ_COMPLIANCE,
    ],
  },
  {
    name: ROLES.EMPLOYEE,
    // Read-only, plus the one thing #719 exists for: an employee filing their
    // own receipts. `submitExpense` restricts an EMPLOYEE account to its own
    // linked employee record, so holding WRITE_EXPENSE does not let someone
    // file a claim against a colleague.
    permissions: [
      PERMISSIONS.READ_EMPLOYEE,
      PERMISSIONS.READ_PAYROLL,
      PERMISSIONS.READ_EXPENSE,
      PERMISSIONS.WRITE_EXPENSE,
    ],
  },
];

module.exports = {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLES,
  ROLE_DEFINITIONS,
  DEFAULT_ROLE,
};
