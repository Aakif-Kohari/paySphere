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
  READ_REPORT: "READ_REPORT",
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
    name: PERMISSIONS.READ_REPORT,
    description: "View analytics and download generated reports",
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
      PERMISSIONS.READ_REPORT,
    ],
  },
  {
    name: ROLES.HR_MANAGER,
    // Can run payroll day to day, but cannot destroy an employee's history.
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
