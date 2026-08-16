/**
 * The application actually loads (#1008).
 *
 * `moduleLoad.test.js` compiles every source file without running it, which
 * catches a syntax error but by construction cannot catch anything that only
 * happens at evaluation time. Both halves of #1008 were evaluation-time:
 *
 *   - `require('../middlewares/auth.middleware')` resolved to nothing, because
 *     the file was `.ts` in a CommonJS project with no build step. Forty-eight
 *     modules require it. `MODULE_NOT_FOUND`, at boot, from the first router
 *     Express reached.
 *
 *   - `app.js` called `swaggerJsdoc(swaggerOptions)` and `swaggerUi.serve`
 *     without importing either. `ReferenceError`, at boot — and a parse check
 *     is blind to it, because a free variable is perfectly valid syntax.
 *
 * The only test that catches that class of bug is one that performs the require
 * for real. This is the cheapest possible version: no database, no listener, no
 * requests. It answers one question — does `require('../app')` return an
 * Express application — which is precisely the question `npm start` asks and
 * that nothing in CI was asking.
 *
 * It is also the check that would have caught #896 (`roleRoutes` mounted but
 * never imported) and #792 (`app.js` left unparseable by a merge) before they
 * reached main. Three separate outages, one missing test.
 *
 * ---
 *
 * The two stubs below are the house pattern, carried from
 * `app.security.test.js` and `metrics.test.js` rather than invented here.
 * `otplib` and `jsdom` (via `utils/sanitizers`) are pure ESM and
 * `transformIgnorePatterns` does not cover either chain, so any suite that
 * requires `app.js` dies on `Unexpected token 'export'` before it runs.
 *
 * That is a real toolchain gap and it is deliberately not fixed here: the
 * dependency tree has ~300 ESM-only packages, so the allowlist approach does
 * not converge, and rewiring the transform is a change whose blast radius is
 * every suite in the project — not something to bundle into a boot fix. Both
 * stubs are pass-throughs and neither can mask what this file asserts: a
 * missing `require` or an unresolvable module still throws, because the module
 * graph around them is loaded for real.
 */

const request = require('supertest');

jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: () => 'TESTSECRET',
    keyuri: () => 'otpauth://totp/test',
    verify: () => false,
  },
}));

// The rate limiters are IP-keyed and stateful; a suite firing repeated
// requests 429s on a later run. Same stub, same reason, as every other suite
// here that makes a request.
jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  authRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
  standardLimiter: (req, res, next) => next(),
  strictLimiter: (req, res, next) => next(),
}));

jest.mock(
  '../middlewares/sanitize.middleware',
  () => (req, res, next) => next(),
);

describe('application boot (#1008)', () => {
  it('loads app.js and gets an Express application back', () => {
    let app;

    // Not `expect(() => require(...)).not.toThrow()`: when this fails, the
    // thing worth reading is the original error — `Cannot find module
    // '../middlewares/auth.middleware'` names the file to go and look at.
    // toThrow's message would bury it.
    app = require('../app');

    expect(typeof app).toBe('function');
    // An Express app is a callable request handler that also carries the
    // server surface. `listen` is what `index.js` reaches for.
    expect(typeof app.listen).toBe('function');
    expect(typeof app.use).toBe('function');
  });

  it('resolves the auth middleware every router depends on', () => {
    // The specific require that took the process down. Named on its own so a
    // regression reads as "auth middleware is gone" rather than as a generic
    // app-load failure forty-eight modules deep.
    const auth = require('../middlewares/auth.middleware');

    expect(typeof auth).toBe('function');
    // Express middleware arity: (req, res, next).
    expect(auth.length).toBe(3);
  });

  it('resolves the jwt utilities', () => {
    // The other `.ts` file. Nothing imports it yet, which is exactly why it
    // could sit broken indefinitely — it would only have failed on the day
    // somebody wired it in.
    const jwtUtils = require('../utils/jwt.utils');

    expect(typeof jwtUtils.generateAccessToken).toBe('function');
    expect(typeof jwtUtils.verifyAccessToken).toBe('function');
    expect(typeof jwtUtils.generateRefreshTokenString).toBe('function');
    expect(typeof jwtUtils.getRefreshTokenExpiry).toBe('function');
  });

  it('has the swagger dependencies it calls', () => {
    // `app.js` uses both of these as free variables. Asserting they are
    // installed separates "the package is missing from package.json" from "the
    // require line is missing from app.js" when the boot test above goes red —
    // two different fixes.
    expect(() => require('swagger-jsdoc')).not.toThrow();
    expect(() => require('swagger-ui-express')).not.toThrow();
  });

  it('serves the OpenAPI docs route', async () => {
    const app = require('../app');

    // The /api-docs mount is the reason the swagger imports exist at all, so
    // it is worth asserting the two stay together: delete the mount and leave
    // the imports, or the reverse, and this goes red.
    //
    // Asked over HTTP rather than by reading the router stack, because Express
    // 5 removed `app._router` — introspecting it throws
    // `Cannot read properties of undefined`, which is a confusing way for a
    // boot test to fail. A request works on both versions and checks the thing
    // that actually matters: the route answers.
    const res = await request(app).get('/api-docs/');

    expect(res.status).not.toBe(404);
  });
});
