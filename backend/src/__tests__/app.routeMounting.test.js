/**
 * The route table is the union of the two copies, and stays that way.
 *
 * #785's merge left `app.js` with two complete route tables that disagreed with
 * each other: the first mounted `/api/archive` and not `/api/notifications`,
 * the second the reverse, and neither mounted `/api/expenses` or
 * `/api/monthly-updates`. Express serves the first match, so which features
 * existed came down to which copy happened to be higher in the file — and
 * nothing failed, the endpoints just quietly 404'd (#792).
 *
 * These assertions are deliberately about *reachability*, not about behaviour:
 * a mounted route that answers 401 or 403 is mounted, and that is the property
 * a merge can silently destroy. What each router does with an authenticated
 * request is its own suite's business.
 */

const request = require('supertest');

// The rate limiters are stubbed for the same reason the payroll and workflow
// route suites stub them: they are IP-keyed and stateful across requests, so a
// suite that fires a few dozen requests will start getting 429s partway through
// and fail on the *second* run rather than the first.
jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  authRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
  standardLimiter: (req, res, next) => next(),
  strictLimiter: (req, res, next) => next(),
}));

// `otplib@13` pulls in `@scure/base`, which is pure ESM with no CommonJS build,
// and this project has no babel preset configured to transform it — so *any*
// suite that reaches `user.controller.js` dies on `Unexpected token 'export'`
// before it runs a line of its own. That is a separate problem from #792 and is
// not fixed here; stubbing the two functions the controller uses keeps this
// suite about route mounting.
jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: () => 'TESTSECRET',
    keyuri: () => 'otpauth://totp/test',
    verify: () => false,
  },
}));

// The same class of problem one layer out, and the reason this suite has never
// actually run (#1008):
//
//     sanitize.middleware → utils/sanitizers → jsdom → parse5 / entities /
//     @asamuzakjp/css-color …
//
// all pure ESM, none of it covered by `transformIgnorePatterns`. The suite died
// on `Unexpected token 'export'` before its first assertion, which reads as a
// broken environment rather than as a failing test — so the route-mounting
// guard #792 added to stop routers going missing was itself missing, and two
// unrelated boot failures sat behind it undetected.
//
// `app.security.test.js` already carries this stub with the same reasoning.
// Pass-through, so it cannot weaken what is asserted below: sanitisation has no
// say in whether a route is mounted.
jest.mock(
  '../middlewares/sanitize.middleware',
  () => (req, res, next) => next(),
);

const app = require('../app');

/**
 * Every path prefix the product expects to be able to reach, with a method and
 * path that exists on that router.
 */
const MOUNTED_ROUTES = [
  ['/api/auth', 'post', '/api/auth/login'],
  ['/api/employees', 'get', '/api/employees'],
  ['/api/payroll', 'get', '/api/payroll/summary'],
  ['/api/reports', 'get', '/api/reports/analytics'],
  ['/api/employee-portal', 'get', '/api/employee-portal/profile'],
  ['/api/schedules', 'get', '/api/schedules'],
  ['/api/audit-logs', 'get', '/api/audit-logs'],
  ['/api/attendance', 'get', '/api/attendance'],
  ['/api/settlements', 'get', '/api/settlements'],
  ['/api/loans', 'get', '/api/loans'],
  ['/api/archive', 'get', '/api/archive/employees'],
  ['/api/workflows', 'get', '/api/workflows'],
  ['/api/flashcards', 'get', '/api/flashcards/my-decks'],
  ['/api/webhooks', 'get', '/api/webhooks'],
  ['/api/dashboard', 'get', '/api/dashboard/layout'],
  ['/api/notifications', 'get', '/api/notifications'],
  [
    '/api/monthly-updates',
    'get',
    '/api/monthly-updates/000000000000000000000000',
  ],
  ['/api/expenses', 'get', '/api/expenses'],
];

describe('app route mounting (#792)', () => {
  it('serves the root probe', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('PaySphere API is running');
  });

  describe.each(MOUNTED_ROUTES)('%s', (prefix, method, path) => {
    it(`is mounted (${method.toUpperCase()} ${path} is not a 404)`, async () => {
      const res = await request(app)[method](path);

      // Unauthenticated, so 401 is the expected answer from a mounted router.
      // Anything other than 404 proves the router is in the table; 404 is the
      // exact symptom the duplicated route tables produced.
      expect(res.status).not.toBe(404);
    });
  });

  it('puts authentication in front of every mounted data route', async () => {
    // The other half of #663: a router mounted above the middleware stack is
    // reachable *and* unguarded. Every one of these should refuse an
    // anonymous caller rather than answering with data.
    for (const [, method, path] of MOUNTED_ROUTES) {
      if (path === '/api/auth/login') continue;

      const res = await request(app)[method](path);
      expect([401, 403]).toContain(res.status);
    }
  });

  it('applies the security headers to a route from each duplicated table', async () => {
    // `/api/archive` came from the first copy and `/api/notifications` from the
    // second. Both must now sit below Helmet — the first copy of the table in
    // the merged file was above it.
    for (const path of ['/api/archive/employees', '/api/notifications']) {
      const res = await request(app).get(path);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    }
  });

  it('rejects a state-changing request with no body', async () => {
    // `requireBody` is mounted on /api, above the routers. #663's duplicate
    // dashboard mount sat above it and threw a TypeError instead.
    const res = await request(app)
      .post('/api/dashboard/layout')
      .set('Content-Type', 'application/json');

    expect(res.status).not.toBe(500);
  });
});

describe('GraphQL wiring (#792)', () => {
  const { isGraphQLAvailable, attachGraphQL } = require('../graphql');

  it('reports whether the optional packages are installed', () => {
    // #539 never added @apollo/server, @as-integrations/express or graphql to
    // backend/package.json, so on a clean checkout this is false. The point of
    // the assertion is that asking the question does not throw.
    expect(typeof isGraphQLAvailable()).toBe('boolean');
  });

  it('does not throw when the packages are missing', async () => {
    const express = require('express');
    const bare = express();

    await expect(attachGraphQL(bare)).resolves.toBe(isGraphQLAvailable());
  });

  it('is not mounted inside app.js', async () => {
    // Apollo's start() is async and cannot run during a module require. If
    // /graphql ever answers straight off `require('../app')` again, someone has
    // put a top-level await back.
    const res = await request(app)
      .post('/graphql')
      .send({ query: '{ __typename }' });

    expect(res.status).toBe(404);
  });
});
