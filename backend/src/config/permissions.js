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
  READ_EMPLOYEE: "READ_EMPLOYEE",
  WRITE_EMPLOYEE: "WRITE_EMPLOYEE",
  DELETE_EMPLOYEE: "DELETE_EMPLOYEE",
  READ_PAYROLL: "READ_PAYROLL",
  WRITE_PAYROLL: "WRITE_PAYROLL",
  // Maker–checker: the account that submits a payroll run should not be the
  // only thing standing between a figure and a bank transfer. Kept separate
  // from WRITE_PAYROLL so the two can be held by different people (#458).
  APPROVE_PAYROLL: "APPROVE_PAYROLL",
  READ_REPORT: "READ_REPORT",
  // Kept apart from READ_REPORT because they are not the same act. Viewing a
  // report is a read; standing up a recurring job that mails a payroll register
  // to an address of your choosing is a write, and a fairly serious one. Both
  // scheduler write routes were gated on READ_REPORT, which every role holds
  // including Employee — so anyone who could view a report could also schedule
  // an export of company salary data to an external mailbox, or delete another
  // admin's schedule (#666).
  MANAGE_REPORT_SCHEDULE: "MANAGE_REPORT_SCHEDULE",
  // A webhook endpoint is a standing instruction to POST company payroll and
  // employee data to an external URL, signed with a secret this account owns.
  // Creating, editing, rotating the secret for or deleting one is a write that
  // can point data anywhere, so it is its own permission and it stays with the
  // owner role — deliberately not something every admin of the workspace can do
  // (#474).
  MANAGE_WEBHOOKS: "MANAGE_WEBHOOKS",
  // Roles decide what everyone in the company may do, and the API that edits
  // them (role.controller.js, #475) is a security mutation of the same kind as
  // the webhooks one: creating a role grants real capabilities, deleting one
  // revokes them from whoever holds it. It is its own permission so the owner
  // role is the only one that can hand itself and the rest of the workspace
  // different powers (#475).
  MANAGE_ROLES: "MANAGE_ROLES",
};

const PERMISSION_DEFINITIONS = [
  {
    name: PERMISSIONS.READ_EMPLOYEE,
    description: "View the employee directory and individual employee records",
  },
  {
    name: PERMISSIONS.WRITE_EMPLOYEE,
    description: "Create and update employees, and import them from CSV",
  },
  {
    name: PERMISSIONS.DELETE_EMPLOYEE,
    description: "Permanently delete an employee and their payroll history",
  },
  {
    name: PERMISSIONS.READ_PAYROLL,
    description: "View payroll summaries and export payroll data",
  },
  {
    name: PERMISSIONS.WRITE_PAYROLL,
    description: "Finalize payroll runs and dispatch payslip emails",
  },
  {
    name: PERMISSIONS.APPROVE_PAYROLL,
    description:
      "Approve or reject a submitted payroll run before it can be paid",
  },
  {
    name: PERMISSIONS.READ_REPORT,
    description: "View analytics and download generated reports",
  },
  {
    name: PERMISSIONS.MANAGE_REPORT_SCHEDULE,
    description:
      "Create and delete recurring report schedules, which mail company data to their recipients",
  },
  {
    name: PERMISSIONS.MANAGE_WEBHOOKS,
    description:
      "Create, update and delete webhook endpoints, which receive company data when payroll or employee events fire",
  },
  {
    name: PERMISSIONS.MANAGE_ROLES,
    description:
      "Create, update and delete custom roles and their permission sets",
  },
];

// --- Roles -----------------------------------------------------------------

const ROLES = {
  SUPER_ADMIN: "SuperAdmin",
  HR_MANAGER: "HRManager",
  EMPLOYEE: "Employee",
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
    ],
  },
  {
    name: ROLES.EMPLOYEE,
    // Read-only.
    permissions: [PERMISSIONS.READ_EMPLOYEE, PERMISSIONS.READ_PAYROLL],
  },
];

module.exports = {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLES,
  ROLE_DEFINITIONS,
  DEFAULT_ROLE,
};
