jest.mock('../../middlewares/auth.middleware', () => jest.fn());
jest.mock('../../middlewares/rbac.middleware', () => ({
  requirePermission: jest.fn(() => jest.fn()),
}));
jest.mock('../../controllers/dashboard.controller', () => ({
  getDashboardSummary: jest.fn(),
}));
jest.mock('../../controllers/dashboardLayout.controller', () => ({
  getLayout: jest.fn(),
  saveLayout: jest.fn(),
}));

const router = require('../dashboard.routes');
const auth = require('../../middlewares/auth.middleware');
const layoutController = require('../../controllers/dashboardLayout.controller');

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

describe('dashboard.routes — unauthenticated layout endpoints (#663)', () => {
  describe('authentication', () => {
    test('GET /layout requires authentication', () => {
      // Before #663 this route had no middleware at all: the handler resolved
      // the caller as `req.user?.id || req.userId || 'anonymous'`, and on an
      // unguarded route the first two are never set. Every visitor read the
      // entry stored under 'anonymous'.
      expect(routeFor('get', '/layout').handlers).toContain(auth);
    });

    test('PUT /layout requires authentication', () => {
      expect(routeFor('put', '/layout').handlers).toContain(auth);
    });

    test('POST /layout requires authentication', () => {
      expect(routeFor('post', '/layout').handlers).toContain(auth);
    });

    test('every route on this router is authenticated', () => {
      for (const route of registeredRoutes()) {
        expect(route.handlers).toContain(auth);
      }
    });
  });

  describe('handlers', () => {
    test('the layout routes delegate to the layout controller', () => {
      expect(routeFor('get', '/layout').handlers).toContain(
        layoutController.getLayout,
      );
      expect(routeFor('put', '/layout').handlers).toContain(
        layoutController.saveLayout,
      );
    });

    test('POST /layout is kept as an alias of PUT for cached clients', () => {
      expect(routeFor('post', '/layout').handlers).toContain(
        layoutController.saveLayout,
      );
    });

    test('the layout handlers are no longer closures over a module-level Map', () => {
      // The old implementation kept `const dashboardLayouts = new Map()` in the
      // router: wiped on deploy, not shared between instances, never evicted.
      const source = require('fs').readFileSync(
        require.resolve('../dashboard.routes'),
        'utf8',
      );

      // Strip comments: the JSDoc quotes the old implementation on purpose.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      expect(code).not.toMatch(/new Map\(\)/);
      expect(code).not.toMatch(/function getUserId/);
      // The `req.user?.id || req.userId || 'anonymous'` fallback, specifically.
      expect(code).not.toMatch(/\|\|\s*['"]anonymous['"]/);
    });
  });

  describe('registration', () => {
    test('registers exactly the layout and summary endpoints', () => {
      const seen = registeredRoutes()
        .map((r) => `${r.method.toUpperCase()} ${r.path}`)
        .sort();

      expect(seen).toEqual([
        'GET /layout',
        'GET /summary',
        'POST /layout',
        'PUT /layout',
      ]);
    });
  });
});
