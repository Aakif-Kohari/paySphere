/**
 * The routers and the permission vocabulary cannot drift apart (#1011).
 *
 * `permissions.expense.test.js` and `permissions.compliance.test.js` each check
 * one router against this file. That has caught real bugs — #794 and #951 were
 * both "a router asks for a name that does not exist here", which is a silent
 * failure: the seeder never creates it, no role holds it, and
 * `requirePermission` denies every caller including the owner, because
 * SUPER_ADMIN is an explicit list and not a wildcard.
 *
 * The gap those two leave is that they only look at the router somebody
 * remembered to write a test for. Eight feature areas shipped between #955 and
 * #993 reusing WRITE_EMPLOYEE and READ_EMPLOYEE as a catch-all, and none of
 * them had a file like this — so nothing objected.
 *
 * This one starts from `routes/` and checks every router in it. A new router
 * asking for a name that does not exist fails by default rather than by
 * diligence, and a state-changing route with no permission gate has to be
 * declared public on purpose.
 */

const fs = require('fs');
const path = require('path');

const {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLES,
  ROLE_DEFINITIONS,
} = require('../permissions');

const ROUTES_DIR = path.join(__dirname, '..', '..', 'routes');

const routerFiles = fs
  .readdirSync(ROUTES_DIR)
  .filter((file) => file.endsWith('.routes.js'))
  .sort();

/**
 * A router's source with comments blanked out.
 *
 * Everything here scans raw text, so a router that *documents* a route in prose
 * gets that prose matched as if it were code. `varianceReport.routes.js` now
 * carries a header quoting the two broken lines it replaced —
 *
 *     router.post('/budget', authorize('MANAGE_REPORTS'), setBudget);
 *
 * — and the gate check duly reported the fixed router as ungated, on the
 * strength of an example explaining the bug that was fixed. `moduleLoad.test.js`
 * had the identical false positive for the identical reason (#1008); a test
 * that fails on its own documentation is one people learn to route around.
 *
 * Comments become spaces rather than disappearing, so offsets are preserved.
 *
 * @param {string} file
 * @returns {string}
 */
const sourceOf = (file) => {
  const raw = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');

  return raw
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (line, prefix) => prefix + ' '.repeat(line.length - prefix.length),
    );
};

/**
 * Every permission name a router asks for.
 *
 * Both spellings are in use — `requirePermission(PERMISSIONS.READ_ASSET)` and
 * the older `requirePermission('READ_PAYROLL')` — and both have to be checked.
 * The string form is the one that can go wrong silently, since a typo in it is
 * just a string.
 *
 * @param {string} source
 * @returns {string[]}
 */
function permissionsAskedFor(source) {
  const viaConstant = [
    ...source.matchAll(/requirePermission\(\s*PERMISSIONS\.([A-Z_]+)/g),
  ];
  const viaLiteral = [
    ...source.matchAll(/requirePermission\(\s*['"]([A-Z_]+)['"]/g),
  ];

  return [...viaConstant, ...viaLiteral].map((match) => match[1]);
}

const declared = new Set(PERMISSION_DEFINITIONS.map((d) => d.name));
const roleNamed = (name) => ROLE_DEFINITIONS.find((r) => r.name === name);

describe('the permission vocabulary is internally consistent', () => {
  it('every key in PERMISSIONS maps to its own name', () => {
    // `READ_ASSET: 'READ_ASSTE'` would otherwise be invisible: the routers
    // would ask for the typo, the seeder would create the typo, and everything
    // would agree with itself while the name in the database is wrong.
    const mismatched = Object.entries(PERMISSIONS).filter(
      ([key, value]) => key !== value,
    );

    expect(mismatched).toEqual([]);
  });

  it('every permission has a definition the seeder can write', () => {
    // A name in PERMISSIONS with no PERMISSION_DEFINITIONS entry is never
    // created as a document, so any role referencing it silently loses it.
    const undefinedNames = Object.values(PERMISSIONS).filter(
      (name) => !declared.has(name),
    );

    expect(undefinedNames).toEqual([]);
  });

  it('every definition has a non-empty description', () => {
    // The description is what an owner reads in the /api/roles UI when they
    // decide whether to grant something. #1011 is largely a story about a
    // permission whose real authority was not what its name suggested.
    const undescribed = PERMISSION_DEFINITIONS.filter(
      (d) => typeof d.description !== 'string' || d.description.trim() === '',
    ).map((d) => d.name);

    expect(undescribed).toEqual([]);
  });

  it('no definition is declared twice', () => {
    const names = PERMISSION_DEFINITIONS.map((d) => d.name);

    expect(names.length).toBe(new Set(names).size);
  });

  it('every role references only permissions that exist', () => {
    const dangling = [];

    for (const role of ROLE_DEFINITIONS) {
      for (const name of role.permissions) {
        if (!declared.has(name)) dangling.push(`${role.name} → ${name}`);
      }
    }

    // `seedRoles` filters unknown names out with a warning rather than
    // failing, so a typo here costs a role one capability and logs a line
    // nobody reads.
    expect(dangling).toEqual([]);
  });

  it('no role lists the same permission twice', () => {
    const duplicated = ROLE_DEFINITIONS.filter(
      (role) => role.permissions.length !== new Set(role.permissions).size,
    ).map((role) => role.name);

    expect(duplicated).toEqual([]);
  });
});

describe('every router asks for permissions that exist', () => {
  it.each(routerFiles)('%s', (file) => {
    const unknown = permissionsAskedFor(sourceOf(file)).filter(
      (name) => !PERMISSIONS[name],
    );

    expect(unknown).toEqual([]);
  });
});

describe('no permission is defined and then never used', () => {
  it('every permission is asked for by a router or held by a role', () => {
    // Dead vocabulary is how a permission ends up meaning something different
    // from what its name says: it stops being enforced anywhere, then gets
    // reused. Anything genuinely reserved for later should be added here with
    // a reason rather than left to look like an oversight.
    const askedAnywhere = new Set(
      routerFiles.flatMap((file) => permissionsAskedFor(sourceOf(file))),
    );
    const heldAnywhere = new Set(
      ROLE_DEFINITIONS.flatMap((role) => role.permissions),
    );

    const orphaned = Object.values(PERMISSIONS).filter(
      (name) => !askedAnywhere.has(name) && !heldAnywhere.has(name),
    );

    expect(orphaned).toEqual([]);
  });
});

describe('state-changing routes are gated', () => {
  /**
   * Routers whose write routes are deliberately reachable without a
   * permission check, and why. Short on purpose — every entry is authority
   * granted to somebody who has not been checked against the role system.
   */
  const UNGATED_BY_DESIGN = {
    // Signing in, registering, refreshing a token, resetting a password. The
    // caller has no session yet by definition.
    'user.routes.js': 'authentication endpoints',
    // The email provider's delivery-status receiver. It has no session and
    // cannot have one; it is verified by the provider's signature.
    'email.routes.js': 'provider webhook, verified by signature',
    // Candidate-facing offer letter acceptance. The recipient has no account;
    // the route is secured by an unguessable magic token.
    'contract.routes.js': 'public candidate routes, secured by magic token',
    // POSH grievances bypass `requirePermission` on purpose in favour of
    // `requireICC`, which checks active committee membership scoped to the
    // tenant and deliberately locks admins out for anti-retaliation reasons.
    'grievance.routes.js': 'ICC membership check instead of RBAC',
    // Employee self-service; the handlers resolve the subject from req.userId.
    'employeePortal.routes.js': 'self-service, scoped to the caller',
    // Per-user UI state. `POST/PUT /layout` writes the caller's own dashboard
    // arrangement and nothing else; there is no cross-user surface to gate.
    'dashboard.routes.js': 'per-user dashboard layout',
    // A user's own decks. Every handler filters on the caller and the tenant,
    // and `cloneDeck` additionally refuses a deck that is not public.
    'flashcard.routes.js': 'self-service, scoped to the caller',
    // Marking your own notifications read, and your own delivery preferences.
    // Gated by `requireTenantScope()` rather than by a permission, which the
    // matcher below accepts as a guard.
    'notification.routes.js': 'self-service, tenant-scoped',
  };

  it.each(routerFiles)('%s', (file) => {
    if (UNGATED_BY_DESIGN[file]) return;

    const source = sourceOf(file);

    // Each `router.post|put|patch|delete(` up to the end of its call. Good
    // enough to tell "this route names a guard" from "this route names none",
    // which is the only question being asked.
    const writeRoutes = [
      ...source.matchAll(/router\.(post|put|patch|delete)\(([\s\S]*?)\);/g),
    ];

    const ungated = writeRoutes
      .filter(
        ([, , body]) =>
          !/requirePermission|requireICC|requireTenantScope/.test(body),
      )
      .map(([, method, body]) => {
        const routePath = (body.match(/['"]([^'"]*)['"]/) || [])[1] || '?';
        return `${method.toUpperCase()} ${routePath}`;
      });

    expect(ungated).toEqual([]);
  });
});

describe('who holds the new permissions (#1011)', () => {
  const owner = () => roleNamed(ROLES.SUPER_ADMIN);
  const hr = () => roleNamed(ROLES.HR_MANAGER);
  const employee = () => roleNamed(ROLES.EMPLOYEE);

  it('the owner holds every permission in the vocabulary', () => {
    // SUPER_ADMIN is an explicit list rather than a wildcard, which is exactly
    // how #794 left the owner unable to use the expense feature. Adding a
    // permission and forgetting this list is the same bug.
    const missing = Object.values(PERMISSIONS).filter(
      (name) => !owner().permissions.includes(name),
    );

    expect(missing).toEqual([]);
  });

  it('HR can issue and recover assets but cannot run depreciation', () => {
    // Assigning a laptop is HR's job. Rewriting the book value of the whole
    // register in one call is an accounting period action.
    expect(hr().permissions).toContain(PERMISSIONS.MANAGE_ASSET);
    expect(hr().permissions).not.toContain(PERMISSIONS.RUN_DEPRECIATION);
  });

  it('HR can read the contractor ledger but cannot set the TDS withheld', () => {
    expect(hr().permissions).toContain(PERMISSIONS.READ_VENDOR);
    expect(hr().permissions).not.toContain(PERMISSIONS.MANAGE_VENDOR);
  });

  it('HR cannot issue an offer letter', () => {
    // Committing the company to a salary sits with the owner, for the same
    // reason APPROVE_PAYROLL does.
    expect(hr().permissions).toContain(PERMISSIONS.READ_CONTRACT);
    expect(hr().permissions).not.toContain(PERMISSIONS.MANAGE_CONTRACT);
  });

  it('HR can raise no client invoices but can see the receivables', () => {
    expect(hr().permissions).toContain(PERMISSIONS.READ_INVOICE);
    expect(hr().permissions).not.toContain(PERMISSIONS.MANAGE_INVOICE);
  });

  it('an employee can submit their own tax proofs', () => {
    // The reverse of the over-granting problem: `POST /api/tax-proofs` asked
    // for WRITE_EMPLOYEE, which an employee does not hold, so
    // TaxProofPortal.jsx 403'd for every user it was built for.
    expect(employee().permissions).toContain(PERMISSIONS.SUBMIT_TAX_PROOF);
  });

  it('an employee can read their own appraisal', () => {
    expect(employee().permissions).toContain(PERMISSIONS.READ_OWN_APPRAISAL);
  });

  it("an employee cannot read everyone else's appraisal", () => {
    expect(employee().permissions).not.toContain(PERMISSIONS.READ_APPRAISAL);
    expect(employee().permissions).not.toContain(PERMISSIONS.MANAGE_APPRAISAL);
  });

  it('an employee cannot verify a tax proof', () => {
    // Approving your own investment proof would be deciding your own TDS.
    expect(employee().permissions).not.toContain(PERMISSIONS.VERIFY_TAX_PROOF);
  });

  it('an employee can see the roster but not publish it', () => {
    expect(employee().permissions).toContain(PERMISSIONS.READ_ROSTER);
    expect(employee().permissions).not.toContain(PERMISSIONS.MANAGE_ROSTER);
  });

  it('an employee holds nothing that writes company-wide data', () => {
    const companyWide = [
      PERMISSIONS.MANAGE_ASSET,
      PERMISSIONS.RUN_DEPRECIATION,
      PERMISSIONS.MANAGE_VENDOR,
      PERMISSIONS.MANAGE_CONTRACT,
      PERMISSIONS.MANAGE_INVOICE,
      PERMISSIONS.MANAGE_PYQ,
      PERMISSIONS.MANAGE_ROLES,
    ];

    const held = companyWide.filter((name) =>
      employee().permissions.includes(name),
    );

    expect(held).toEqual([]);
  });
});

describe('the catch-all is gone from the feature routers', () => {
  // The measurement from the issue: WRITE_EMPLOYEE and READ_EMPLOYEE guarded
  // 36 of 52 gated routes. These eleven are the routers that were leaning on
  // them for things that have nothing to do with employee records.
  const FEATURE_ROUTERS = [
    'asset.routes.js',
    'vendor.routes.js',
    'shiftRoster.routes.js',
    'contract.routes.js',
    'appraisal.routes.js',
    'clientInvoice.routes.js',
    'taxProof.routes.js',
    'pyq.routes.js',
  ];

  it.each(FEATURE_ROUTERS)('%s no longer uses WRITE_EMPLOYEE', (file) => {
    expect(permissionsAskedFor(sourceOf(file))).not.toContain('WRITE_EMPLOYEE');
  });

  it.each(FEATURE_ROUTERS)('%s no longer uses READ_EMPLOYEE', (file) => {
    expect(permissionsAskedFor(sourceOf(file))).not.toContain('READ_EMPLOYEE');
  });

  it('asset depreciation has a permission of its own', () => {
    // The line from the issue:
    //   router.post('/depreciate', auth, requirePermission('WRITE_EMPLOYEE'), …)
    expect(permissionsAskedFor(sourceOf('asset.routes.js'))).toContain(
      'RUN_DEPRECIATION',
    );
  });
});
