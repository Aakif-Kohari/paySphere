/**
 * The expense permissions exist, and the roles that need them hold them (#794).
 *
 * `routes/expense.routes.js` has asked for `READ_EXPENSE`, `WRITE_EXPENSE` and
 * `APPROVE_EXPENSE` since #719 wrote it. None of them were declared here, so the
 * seeder never created them, no role held them, and `requirePermission` denied
 * every expense request from every account in the product — including the owner,
 * because SUPER_ADMIN is an explicit list rather than a wildcard.
 *
 * The whole point of this file, per its own header, is that "the set of
 * permission names can never drift between what gets written to the database and
 * what the routes ask for". This is the check that makes that true rather than
 * aspirational: it reads the names straight out of the router.
 */

const fs = require('fs');
const path = require('path');
const {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLES,
  ROLE_DEFINITIONS,
} = require('../permissions');

const declared = new Set(PERMISSION_DEFINITIONS.map((d) => d.name));
const roleNamed = (name) => ROLE_DEFINITIONS.find((r) => r.name === name);

describe('the expense permissions are declared', () => {
  it.each([
    'READ_EXPENSE',
    'WRITE_EXPENSE',
    'APPROVE_EXPENSE',
    'MANAGE_EXPENSE_CATEGORY',
  ])('%s exists in the vocabulary', (name) => {
    expect(PERMISSIONS[name]).toBe(name);
  });

  it('every permission in the vocabulary has a definition the seeder can write', () => {
    // A name in PERMISSIONS with no PERMISSION_DEFINITIONS entry is never
    // created, so a route asking for it denies every caller — silently, and
    // identically to the name not existing at all.
    const missing = Object.values(PERMISSIONS).filter((n) => !declared.has(n));

    expect(missing).toEqual([]);
  });

  it('every definition has a description', () => {
    const undescribed = PERMISSION_DEFINITIONS.filter(
      (d) => !d.description || !d.description.trim(),
    ).map((d) => d.name);

    expect(undescribed).toEqual([]);
  });
});

describe('the routers only ask for permissions that exist', () => {
  // The drift check, run over the routes rather than over a hand-maintained
  // list, so a new route asking for a permission nobody declared fails here
  // instead of in production as a 403.
  const routesDir = path.join(__dirname, '..', '..', 'routes');
  const routeFiles = fs
    .readdirSync(routesDir)
    .filter((f) => f.endsWith('.routes.js'));

  it.each(routeFiles)('%s', (file) => {
    const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
    const asked = new Set();

    // `requirePermission('WRITE_EXPENSE')` and
    // `requirePermission(PERMISSIONS.WRITE_EXPENSE)` are both in use.
    for (const m of source.matchAll(
      /requirePermission\(\s*['"]([A-Z_]+)['"]\s*\)/g,
    )) {
      asked.add(m[1]);
    }
    for (const m of source.matchAll(
      /requirePermission\(\s*PERMISSIONS\.([A-Z_]+)\s*\)/g,
    )) {
      asked.add(m[1]);
    }

    const unknown = [...asked].filter((name) => !declared.has(name));

    expect(unknown).toEqual([]);
  });
});

describe('who holds them', () => {
  it('the owner holds all four', () => {
    const owner = roleNamed(ROLES.SUPER_ADMIN);

    expect(owner.permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.READ_EXPENSE,
        PERMISSIONS.WRITE_EXPENSE,
        PERMISSIONS.APPROVE_EXPENSE,
        PERMISSIONS.MANAGE_EXPENSE_CATEGORY,
      ]),
    );
  });

  it('HR can file and sign off claims but cannot re-tax a category', () => {
    // `isTaxable` decides whether a claim is paid as earnings before tax or as
    // a tax-free reimbursement after it. That is a tax decision, so it stays
    // with the owner.
    const hr = roleNamed(ROLES.HR_MANAGER);

    expect(hr.permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.READ_EXPENSE,
        PERMISSIONS.WRITE_EXPENSE,
        PERMISSIONS.APPROVE_EXPENSE,
      ]),
    );
    expect(hr.permissions).not.toContain(PERMISSIONS.MANAGE_EXPENSE_CATEGORY);
  });

  it('an employee can file their own receipts and nothing more', () => {
    const employee = roleNamed(ROLES.EMPLOYEE);

    expect(employee.permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.READ_EXPENSE,
        PERMISSIONS.WRITE_EXPENSE,
      ]),
    );
    // Signing off your own claim is the thing the split exists to prevent.
    expect(employee.permissions).not.toContain(PERMISSIONS.APPROVE_EXPENSE);
    expect(employee.permissions).not.toContain(
      PERMISSIONS.MANAGE_EXPENSE_CATEGORY,
    );
  });

  it('every permission a role references is a real one', () => {
    const dangling = ROLE_DEFINITIONS.flatMap((role) =>
      role.permissions
        .filter((name) => !declared.has(name))
        .map((name) => `${role.name} -> ${name}`),
    );

    expect(dangling).toEqual([]);
  });
});
