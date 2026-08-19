/**
 * Account types — *who* an account is, as opposed to *what it may do*.
 *
 * PaySphere has two orthogonal notions of "role" and #443 collapsed them onto
 * one field name:
 *
 *   1. The RBAC role  — a `Role` document holding a set of `Permission`s.
 *                       Lives on `User.role`, consumed by `requirePermission`.
 *   2. The account type — whether this login is the business owner's console
 *                       or an employee's read-only self-service portal.
 *
 * Declaring both as `role` on the User schema meant the second silently
 * overwrote the first, taking signup and the entire permission system with it
 * (#558). They are separate concepts, so they get separate fields, and the
 * vocabulary for the second one lives here — mirroring how config/permissions.js
 * and config/payrollStatus.js own their vocabularies.
 */

const ACCOUNT_TYPE = {
  /** The account that registered the company. Full console access. */
  ADMIN: 'ADMIN',
  /** A login linked to an Employee record. Self-service portal only. */
  EMPLOYEE: 'EMPLOYEE',
};

const ALL_ACCOUNT_TYPES = Object.values(ACCOUNT_TYPE);

/**
 * The type assigned to an account that has never had one set.
 *
 * Every account that exists today was created through `signup` or `googleAuth`,
 * both of which register a company — so they are all owners. Employee logins
 * only ever arrive with `employeeId` set, which `resolveAccountType` keys off.
 */
const DEFAULT_ACCOUNT_TYPE = ACCOUNT_TYPE.ADMIN;

/**
 * Work out an account's type without trusting a single field.
 *
 * `authorize()` used to read `req.user.role` and fall back to the string
 * `"ADMIN"` whenever it could not tell:
 *
 *     const userRole = (req.user && req.user.role) || req.userRole || "ADMIN";
 *
 * That is a fail-open default on an authorization check — an account whose type
 * cannot be read is granted the most privileged one. This resolves from the
 * account's own shape instead: a login bound to an Employee record is an
 * employee, and only an unbound login is treated as an owner.
 *
 * @param {object|null|undefined} user a User document or lean object
 * @returns {string|null} an ACCOUNT_TYPE value, or null if there is no user
 */
function resolveAccountType(user) {
  if (!user || typeof user !== 'object') return null;

  if (isAccountType(user.accountType)) {
    return user.accountType;
  }

  // Pre-#558 accounts have no `accountType` yet. The migration backfills them,
  // but the middleware must stay correct on a database that has not been
  // migrated — including one where `role` still holds the clobbered string.
  if (isAccountType(user.role)) {
    return user.role;
  }

  return user.employeeId ? ACCOUNT_TYPE.EMPLOYEE : DEFAULT_ACCOUNT_TYPE;
}

/**
 * @param {*} value
 * @returns {boolean} whether the value is a known account type
 */
function isAccountType(value) {
  return typeof value === 'string' && ALL_ACCOUNT_TYPES.includes(value);
}

module.exports = {
  ACCOUNT_TYPE,
  ALL_ACCOUNT_TYPES,
  DEFAULT_ACCOUNT_TYPE,
  resolveAccountType,
  isAccountType,
};
