/**
 * The export surface of `rbac.middleware.js` (#1078).
 *
 * `rbac.middleware.test.js` next door tests what `requirePermission` and
 * `authorize` *do*. It cannot catch what actually happened in #1057, which is
 * that they stopped existing: the suite fails with
 * `requirePermission is not a function` and reads as thirty broken tests rather
 * than as one removed export, and it sits alongside sixty other failures with
 * the same cause.
 *
 * The failure mode is worth stating plainly because it has now happened four
 * times in this codebase (#792, #896, #1008, #1078). A module's exports and the
 * code that consumes them are edited in different files. Nothing type-checks
 * the join. Every consumer calls the missing name *at module scope* — because
 * `router.post('/x', requirePermission('Y'), handler)` runs when the router is
 * required — so the first symptom is not a failing endpoint, it is
 * `require('./app')` throwing and no server existing.
 *
 * So: this file asserts the contract itself, by name, with no database and no
 * HTTP. If someone rewrites this middleware again, they get a one-line failure
 * naming the export they dropped.
 */

const path = require('path');

// Every dependency of the middleware is stubbed. The point of this suite is the
// shape of the module, and reaching for Mongoose models or the seeder to
// establish that would make it fail for reasons that are not the contract.
jest.mock('../../models/user.model', () => ({
  findById: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));
jest.mock('../../seeds/rbac.seed', () => ({ getDefaultRole: jest.fn() }));

const rbac = require('../rbac.middleware');

/**
 * Names this module must export, and who asks for each one.
 *
 * The "used by" column is not decoration. #1057's replacement kept the three
 * names its own two routers needed and dropped the four that thirty-three
 * others did, which is an easy mistake to make when the consumers are not
 * written down anywhere.
 */
const REQUIRED_EXPORTS = [
  // name, used by
  [
    'requirePermission',
    '33 routers in routes/, via requirePermission(PERMISSIONS.X)',
  ],
  ['authorize', 'employeePortal.routes.js, scheduler.routes.js'],
  ['resolveRole', 'rbac.middleware.test.js, and requirePermission itself'],
  ['requireScope', 'employee.routes.js, payroll.routes.js (#689)'],
  ['checkScope', 'requireScope, and its own unit tests'],
  ['roles', 'the static scope table #689 added'],
];

describe('rbac.middleware export surface (#1078)', () => {
  it.each(REQUIRED_EXPORTS)('exports %s — used by %s', (name) => {
    expect(rbac[name]).toBeDefined();
  });

  it('exports the four middleware factories as callables', () => {
    // `toBeDefined` above would be satisfied by an object or a string. These
    // four are called as functions at router module scope, so being defined is
    // not the property that matters.
    for (const name of [
      'requirePermission',
      'authorize',
      'requireScope',
      'checkScope',
    ]) {
      expect(typeof rbac[name]).toBe('function');
    }
  });

  it('still exports authorize as the module itself', () => {
    // `const authorize = require('../middlewares/rbac.middleware')` is how two
    // routers import it. Replacing `module.exports = authorize` with a plain
    // object breaks them without touching a line they contain.
    expect(typeof rbac).toBe('function');
    expect(rbac).toBe(rbac.authorize);
  });

  it('exports STRICT_MODE as a boolean', () => {
    // Read as a flag, so `undefined` would silently mean "not strict" rather
    // than failing.
    expect(typeof rbac.STRICT_MODE).toBe('boolean');
  });

  it('returns middleware of the right arity from each factory', () => {
    // Express dispatches on `fn.length`: a 4-argument function is an error
    // handler, not a request handler, and mounting one as a guard silently
    // skips it. Each of these must produce a (req, res, next).
    expect(rbac.requirePermission('READ_EMPLOYEE')).toHaveLength(3);
    expect(rbac.authorize('ADMIN')).toHaveLength(3);
    expect(rbac.requireScope('employee:read')).toHaveLength(3);
  });
});

describe('every router can be required (#1078)', () => {
  // The end-to-end version of the same property, and the one that was actually
  // failing: `routes/*.routes.js` calls these factories at module scope, so a
  // missing export takes the whole file down at require time.
  //
  // `routerHandlerContract.test.js` covers this too, but it loads controllers
  // and models as a side effect, so when it goes red the cause is not obvious.
  // Here the only thing being proven is that the guard names resolve.
  const fs = require('fs');
  const ROUTES_DIR = path.join(__dirname, '..', '..', 'routes');

  const routerFiles = fs
    .readdirSync(ROUTES_DIR)
    .filter((file) => file.endsWith('.routes.js'))
    .sort();

  it('finds a plausible number of routers', () => {
    // A guard on the guard: an empty read makes the rows below pass vacuously.
    expect(routerFiles.length).toBeGreaterThan(30);
  });

  it('names no guard that this middleware does not export', () => {
    // Static rather than executed: reading the source tells us which names the
    // routers destructure without pulling every controller into this process.
    const unknown = [];

    for (const file of routerFiles) {
      const source = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');

      // `const { a, b } = require('../middlewares/rbac.middleware')`
      const destructured = source.match(
        /const\s*{([^}]*)}\s*=\s*require\(\s*['"][^'"]*rbac\.middleware['"]\s*\)/,
      );

      if (!destructured) continue;

      for (const raw of destructured[1].split(',')) {
        const name = raw.split(':')[0].trim();
        if (name && rbac[name] === undefined) {
          unknown.push(`${file} → ${name}`);
        }
      }
    }

    expect(unknown).toEqual([]);
  });
});
