jest.mock('../../middlewares/auth.middleware', () => jest.fn());
jest.mock('../../middlewares/rbac.middleware', () => ({
  requirePermission: jest.fn(() => jest.fn()),
}));

const router = require('../search.routes');
const auth = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../../config/permissions');

/** Flatten the express router stack into { path, method, handlers }. */
const registeredRoutes = () =>
  router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => ({
        path: layer.route.path,
        method,
        handlers: layer.route.stack.map((s) => s.handle),
      })),
    );

const routeFor = (method, path) =>
  registeredRoutes().find((r) => r.method === method && r.path === path);

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

/**
 * `search.routes.js` wiring (#895).
 *
 * The bug this file exists for is that requiring this module used to throw:
 *
 *     const { verifyToken } = require('../middlewares/auth.middleware');
 *     router.get('/', verifyToken, globalSearch);
 *
 * `auth.middleware` exports the function itself, so `verifyToken` was
 * `undefined` and `router.get` threw at require time — which meant `app.js`
 * threw, which meant no server. It is the third time that exact destructure has
 * taken the process down (#614, #771, this one), and the reason it keeps
 * happening is that nothing catches it until boot. These assertions catch it in
 * CI: the first test fails on `require`, and the second fails on an `undefined`
 * anywhere in a handler stack.
 */

describe('search.routes — the module can be required at all (#895)', () => {
  test('requiring the router does not throw', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  test('every handler in every stack is a function', () => {
    // The generic form of the bug. `router.get(path, undefined, handler)` is
    // what threw; asserting the shape of the stack catches the next variant of
    // it — a controller renamed, an export removed, a destructure that misses.
    for (const route of registeredRoutes()) {
      for (const handler of route.handlers) {
        expect(typeof handler).toBe('function');
      }
    }
  });

  test('exactly one route is registered', () => {
    expect(registeredRoutes()).toHaveLength(1);
  });
});

describe('search.routes — authentication and scope', () => {
  test('GET / requires authentication', () => {
    expect(routeFor('get', '/').handlers).toContain(auth);
  });

  test('GET / carries a tenant guard, a permission gate and the handler', () => {
    // auth -> requireTenantScope -> requireIndexPermission -> globalSearch.
    // Asserted by count rather than identity because two of them are closures
    // built at mount time; the individual behaviours are covered below.
    expect(routeFor('get', '/').handlers).toHaveLength(4);
  });
});

describe('search.routes — the permission follows the index (#895)', () => {
  beforeEach(() => {
    requirePermission.mockClear();
  });

  /** Run just the permission-gate layer of the stack. */
  const runGate = (query) => {
    const gate = routeFor('get', '/').handlers[2];
    const res = makeRes();
    const next = jest.fn();
    gate({ query }, res, next);

    return { res, next };
  };

  test('searching employees requires READ_EMPLOYEE', () => {
    runGate({ index: 'employees' });

    expect(requirePermission).toHaveBeenCalledWith(PERMISSIONS.READ_EMPLOYEE);
  });

  test('searching payroll requires READ_PAYROLL', () => {
    // The escalation this closes: one route serving several indices must not
    // settle on the weakest of their permissions. `?index=payroll` was a
    // full-text search over salary data for anyone holding a token, while
    // `GET /api/payroll` sat behind READ_PAYROLL.
    runGate({ index: 'payroll' });

    expect(requirePermission).toHaveBeenCalledWith(PERMISSIONS.READ_PAYROLL);
  });

  test('the default index is employees, and is gated as such', () => {
    runGate({});

    expect(requirePermission).toHaveBeenCalledWith(PERMISSIONS.READ_EMPLOYEE);
  });

  test('an unknown index is refused rather than passed through ungated', () => {
    // If an unresolvable index fell through to the handler, naming a nonsense
    // index would be a way to skip the permission check entirely.
    const { res, next } = runGate({ index: 'audit-logs' });

    expect(requirePermission).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('the index is matched case-insensitively', () => {
    runGate({ index: 'PAYROLL' });

    expect(requirePermission).toHaveBeenCalledWith(PERMISSIONS.READ_PAYROLL);
  });
});
