/**
 * No router hands Express an `undefined` handler.
 *
 * This is the #614 failure mode, and mounting eleven new routers (#1009) is
 * exactly the moment it bites. From the note in `app.js`:
 *
 *   > It could not simply be added either: the router destructured a
 *   > `verifyToken` export that does not exist, so mounting it threw at require
 *   > time and took the process down at boot.
 *
 * The shape is always the same. A router does
 *
 *     const { createThing, updateThing } = require('../controllers/thing.controller');
 *     router.post('/', auth, createThing);
 *
 * and the controller exports `create` rather than `createThing`. Destructuring
 * a missing export is not an error in JavaScript — it yields `undefined` — so
 * the file requires cleanly and the failure surfaces at `router.post(...)` as
 * `Route.post() requires a callback function but got a [object Undefined]`.
 *
 * Two things make that worse than it sounds:
 *
 *   - It happens at require time, so it is a boot failure for the whole
 *     process, not a 500 on one endpoint.
 *   - Until #1009 an unmounted router was never required at all, so a typo in
 *     one of the eleven could sit in the tree indefinitely. They are all
 *     required now.
 *
 * Requiring each router in isolation and walking its stack answers the question
 * directly, and does it per-file so the failure names the router rather than
 * just failing the boot.
 */

const fs = require('fs');
const path = require('path');

jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: () => 'TESTSECRET',
    keyuri: () => 'otpauth://totp/test',
    verify: () => false,
  },
}));

jest.mock(
  '../middlewares/sanitize.middleware',
  () => (req, res, next) => next(),
);

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

const routerFiles = fs
  .readdirSync(ROUTES_DIR)
  .filter((file) => file.endsWith('.routes.js'))
  .sort();

/**
 * Every handler registered on a router, flattened.
 *
 * An Express router keeps a `stack` of layers. A layer is either a mounted
 * middleware (`router.use`) or a route, and a route keeps its own stack — one
 * entry per handler in the chain, so `router.post('/', auth, limiter, create)`
 * contributes three. All of them have to be functions.
 *
 * @param {import("express").Router} router
 * @returns {Array<{method: string, path: string, index: number, handle: unknown}>}
 */
function collectHandlers(router) {
  const handlers = [];
  const stack = router?.stack || [];

  for (const layer of stack) {
    if (layer.route) {
      const routePath = layer.route.path;
      const methods = Object.keys(layer.route.methods || {})
        .map((method) => method.toUpperCase())
        .join('|');

      layer.route.stack.forEach((routeLayer, index) => {
        handlers.push({
          method: methods || 'USE',
          path: routePath,
          index,
          handle: routeLayer.handle,
        });
      });

      continue;
    }

    handlers.push({
      method: 'USE',
      path: layer.regexp ? String(layer.regexp) : '/',
      index: 0,
      handle: layer.handle,
    });
  }

  return handlers;
}

describe('router handler contract (#614, #1009)', () => {
  it('finds a plausible number of routers', () => {
    // A guard on the guard: an empty read would make every case below pass
    // vacuously.
    expect(routerFiles.length).toBeGreaterThan(20);
  });

  it.each(routerFiles)('%s loads without throwing', (file) => {
    // The boot failure itself. A router that destructures a missing controller
    // export throws here, at `router.post(...)`, during require.
    expect(() => require(path.join(ROUTES_DIR, file))).not.toThrow();
  });

  it.each(routerFiles)('%s registers only callable handlers', (file) => {
    const router = require(path.join(ROUTES_DIR, file));
    const bad = collectHandlers(router)
      .filter(({ handle }) => typeof handle !== 'function')
      .map(
        ({ method, path: routePath, index, handle }) =>
          `${method} ${routePath} handler[${index}] is ${typeof handle}`,
      );

    expect(bad).toEqual([]);
  });

  it.each(routerFiles)('%s exports an Express router', (file) => {
    const router = require(path.join(ROUTES_DIR, file));

    // `module.exports = router` is easy to forget on a new file, and the
    // symptom — `Router.use() requires a middleware function but got a Object`
    // — names app.js rather than the router that caused it.
    expect(typeof router).toBe('function');
    expect(Array.isArray(router.stack)).toBe(true);
  });

  it.each(routerFiles)('%s registers at least one route', (file) => {
    const router = require(path.join(ROUTES_DIR, file));

    // An empty router is mounted, answers 404 for everything, and looks
    // healthy from app.js. Worth failing loudly rather than shipping a prefix
    // that silently does nothing.
    expect(collectHandlers(router).length).toBeGreaterThan(0);
  });

  it('puts an authentication guard on every non-public route', () => {
    // Not a permission check — that is RBAC's job and a separate concern. This
    // only asks whether *something* stands in front of each handler, because a
    // route registered as `router.get('/', getThing)` with no guard at all is
    // the kind of thing that reads fine in review.
    const PUBLIC_BY_DESIGN = {
      // Signing in is how a caller gets a token.
      'user.routes.js': true,
      // The email provider's delivery-status receiver: no session, verified by
      // the provider's signature instead.
      'email.routes.js': true,
      // Candidate-facing offer letter views, secured by an unguessable magic
      // token because the recipient has no account yet.
      'contract.routes.js': true,
      // Kubernetes and Prometheus probes, deliberately outside /api.
      'health.routes.js': true,
    };

    const unguarded = [];

    for (const file of routerFiles) {
      if (PUBLIC_BY_DESIGN[file]) continue;

      const router = require(path.join(ROUTES_DIR, file));

      for (const layer of router.stack) {
        if (!layer.route) continue;

        // A guarded route always has more than just its controller in the
        // chain — `auth` at minimum, usually `requirePermission` and a rate
        // limiter too.
        if (layer.route.stack.length < 2) {
          const methods = Object.keys(layer.route.methods || {})
            .map((method) => method.toUpperCase())
            .join('|');

          unguarded.push(`${file}: ${methods} ${layer.route.path}`);
        }
      }
    }

    expect(unguarded).toEqual([]);
  });
});
