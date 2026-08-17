jest.mock('../../middlewares/auth.middleware', () => jest.fn());
jest.mock('../../middlewares/rbac.middleware', () => ({
  requirePermission: jest.fn(() => jest.fn()),
}));
jest.mock('../../controllers/archive.controller', () => ({
  getArchivedEmployees: jest.fn(),
  getArchivedEmployee: jest.fn(),
}));

const router = require('../archive.routes');
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

/**
 * `archive.routes.js` (#759, gated in #897).
 *
 * The archive returns whole employee documents — salary, email, department —
 * for records that have been deleted. It was behind `auth` and nothing else,
 * so any authenticated account could read it, including an EMPLOYEE-type
 * account whose access is meant to stop at the self-service portal.
 * `GET /api/employees` sits behind READ_EMPLOYEE; deleting a record should not
 * widen who can read it.
 */

describe('archive.routes — wiring', () => {
  test('the router can be required and every handler is a function', () => {
    // The comment in this file has warned since #614 that destructuring `auth`
    // yields `undefined` and throws at require time. Asserting it is cheaper
    // than the comment.
    for (const route of registeredRoutes()) {
      for (const handler of route.handlers) {
        expect(typeof handler).toBe('function');
      }
    }
  });

  test('both read routes are registered', () => {
    expect(routeFor('get', '/employees')).toBeDefined();
    expect(routeFor('get', '/employees/:id')).toBeDefined();
  });

  test('no write route is exposed here', () => {
    // Restore lives on the employee router, which already owns the lifecycle of
    // an employee record. A second endpoint doing the same write is a second
    // place for the ownership check to drift.
    const methods = registeredRoutes().map((r) => r.method);

    expect(methods.every((m) => m === 'get')).toBe(true);
  });
});

describe('archive.routes — access control (#897)', () => {
  test('the list requires authentication', () => {
    expect(routeFor('get', '/employees').handlers).toContain(auth);
  });

  test('the single-record route requires authentication', () => {
    expect(routeFor('get', '/employees/:id').handlers).toContain(auth);
  });

  test('both routes are gated on READ_EMPLOYEE', () => {
    expect(requirePermission).toHaveBeenCalledWith(PERMISSIONS.READ_EMPLOYEE);
    expect(requirePermission).toHaveBeenCalledTimes(2);
  });

  test('both routes carry a tenant guard as well as a permission', () => {
    // auth -> requireTenantScope -> requirePermission -> handler.
    expect(routeFor('get', '/employees').handlers).toHaveLength(4);
    expect(routeFor('get', '/employees/:id').handlers).toHaveLength(4);
  });
});
