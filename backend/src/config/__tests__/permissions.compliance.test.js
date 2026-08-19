/**
 * The compliance permissions exist, and the right roles hold them (#951).
 *
 * Same check, and the same reason, as `permissions.expense.test.js`: a name a
 * router asks for that is missing from this file is not a loud failure. The
 * seeder never creates it, no role holds it, and `requirePermission` denies
 * every caller — including the owner, because SUPER_ADMIN is an explicit list
 * and not a wildcard. That is #794 exactly, and it cost the expense feature
 * months of being mounted and unusable.
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

const routerSource = fs.readFileSync(
  path.join(__dirname, '../../routes/compliance.routes.js'),
  'utf8',
);

describe('the compliance permissions are declared', () => {
  it.each(['READ_COMPLIANCE', 'MANAGE_COMPLIANCE'])(
    '%s exists in the vocabulary',
    (name) => {
      expect(PERMISSIONS[name]).toBe(name);
      expect(declared.has(name)).toBe(true);
    },
  );

  it('the router only asks for permissions that exist', () => {
    // Read straight out of the router, so the two cannot drift.
    const asked = new Set(
      [...routerSource.matchAll(/PERMISSIONS\.([A-Z_]+)/g)].map((m) => m[1]),
    );

    expect(asked.size).toBeGreaterThan(0);

    const unknown = [...asked].filter((name) => !PERMISSIONS[name]);

    expect(unknown).toEqual([]);
  });
});

describe('who holds them', () => {
  it('the owner can both read and manage', () => {
    const owner = roleNamed(ROLES.SUPER_ADMIN);

    expect(owner.permissions).toContain(PERMISSIONS.READ_COMPLIANCE);
    expect(owner.permissions).toContain(PERMISSIONS.MANAGE_COMPLIANCE);
  });

  it('HR can issue certificates but cannot change the TAN they are filed under', () => {
    const hr = roleNamed(ROLES.HR_MANAGER);

    expect(hr.permissions).toContain(PERMISSIONS.READ_COMPLIANCE);
    expect(hr.permissions).not.toContain(PERMISSIONS.MANAGE_COMPLIANCE);
  });

  it('an employee gets neither', () => {
    // A Form 24Q export is every colleague's PAN, salary and tax in one file.
    const employee = roleNamed(ROLES.EMPLOYEE);

    expect(employee.permissions).not.toContain(PERMISSIONS.READ_COMPLIANCE);
    expect(employee.permissions).not.toContain(PERMISSIONS.MANAGE_COMPLIANCE);
  });

  it('is not folded into READ_REPORT', () => {
    // The whole reason these two names exist rather than reusing the report
    // permission: "view analytics" and "download every employee's PAN, salary
    // and tax in one file" are not the same authority, and a role can hold the
    // first without being trusted with the second.
    expect(routerSource).not.toContain('PERMISSIONS.READ_REPORT');
    expect(roleNamed(ROLES.HR_MANAGER).permissions).toContain(
      PERMISSIONS.READ_REPORT,
    );
  });
});
