/**
 * The middleware stack contains what the route table assumes it contains.
 *
 * `app.js` had two halves of one reconstruction go missing (#896):
 *
 *   - `app.use('/api/roles', roleRoutes)` was in the route table and
 *     `require('./routes/role.routes')` was not, so evaluating the module threw
 *     `ReferenceError: roleRoutes is not defined` and there was no server.
 *   - `helmet` and `morgan` were required at the top of the file and neither
 *     was ever called, so the API served no CSP, no `nosniff`, no
 *     `Referrer-Policy`, no frame protection and no access log — while the
 *     comment above the dashboard mount described "no security headers" as a
 *     bug that had been fixed.
 *
 * `app.routeMounting.test.js` covers reachability. This file covers the two
 * properties a mounted route depends on and cannot assert for itself: that
 * every router named in the table is actually imported, and that the stack in
 * front of it does what the comments say it does.
 */

const request = require('supertest');

// Stubbed for the same reason app.routeMounting.test.js stubs them: IP-keyed
// and stateful across requests, so a suite firing a few dozen requests starts
// getting 429s partway through.
jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  authRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
  standardLimiter: (req, res, next) => next(),
  strictLimiter: (req, res, next) => next(),
}));

// `otplib@13` pulls in pure-ESM `@scure/base` and this project has no babel
// transform for it, so any suite reaching user.controller.js dies on
// `Unexpected token 'export'`. Separate problem, not fixed here.
jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: () => 'TESTSECRET',
    keyuri: () => 'otpauth://totp/test',
    verify: () => false,
  },
}));

const app = require('../app');

describe('app.js can be evaluated at all (#896)', () => {
  it('requires without throwing', () => {
    // The regression, in the only form it can be asserted: a ReferenceError on
    // a free variable in the route table fails every test in this file at the
    // `require` above, before an assertion runs.
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });

  it('serves the root probe', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
  });
});

describe('/api/roles is mounted (#896)', () => {
  it('is reachable — not a 404', async () => {
    // `role.routes.js`, `role.controller.js` and the RolesPermissions page were
    // all complete. Only the import was missing.
    const res = await request(app).get('/api/roles');

    expect(res.status).not.toBe(404);
  });

  it('refuses an anonymous caller', async () => {
    // Roles decide what every account in the workspace may do, so the listing
    // is security-relevant in the same way the writes are.
    const res = await request(app).get('/api/roles');

    expect([401, 403]).toContain(res.status);
  });

  it('refuses an anonymous write', async () => {
    const res = await request(app).post('/api/roles').send({ name: 'Auditor' });

    expect([401, 403]).toContain(res.status);
  });
});

describe('security headers (#896)', () => {
  /** Helmet is mounted above the whole route table, so any path will do. */
  const headersFor = async (path = '/') =>
    (await request(app).get(path)).headers;

  it('sends a Content-Security-Policy', async () => {
    const headers = await headersFor();

    expect(headers['content-security-policy']).toBeDefined();
  });

  it('the policy allows nothing by default — this server returns JSON', async () => {
    const headers = await headersFor();

    expect(headers['content-security-policy']).toMatch(/default-src 'none'/);
  });

  it('refuses to be framed', async () => {
    // Without this every authenticated page of the product is clickjackable.
    // `frame-ancestors` is the directive browsers actually honour;
    // `X-Frame-Options` is the legacy half of the same idea and Helmet sends
    // both, so both are asserted.
    const headers = await headersFor();

    expect(headers['content-security-policy']).toMatch(
      /frame-ancestors 'none'/,
    );
    expect(headers['x-frame-options']).toBeDefined();
  });

  it('sends X-Content-Type-Options: nosniff', async () => {
    const headers = await headersFor();

    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  it('sends a Referrer-Policy', async () => {
    const headers = await headersFor();

    expect(headers['referrer-policy']).toBeDefined();
  });

  it('does not advertise Express', async () => {
    const headers = await headersFor();

    expect(headers['x-powered-by']).toBeUndefined();
  });

  it('leaves the cross-origin decision to the CORS config', async () => {
    // Helmet 8 defaults CORP to `same-origin`, which blocks the frontend on
    // :5173 from reading responses from the API on :5000 even when the CORS
    // config allows the origin — they are two separate checks and both have to
    // pass. Getting this wrong breaks every request the product makes, so it is
    // worth an assertion rather than a comment.
    const headers = await headersFor();

    expect(headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('the headers reach every kind of route (#896)', () => {
  // The failure mode #663 described: a router mounted above the stack gets none
  // of it. Sampling one route from each part of the table — including the two
  // that came from different copies of the duplicated route table in #792 — is
  // what catches a mount that has drifted back above Helmet.
  const SAMPLE_PATHS = [
    '/',
    '/api/employees',
    '/api/payroll/summary',
    '/api/roles',
    '/api/archive/employees',
    '/api/notifications',
    '/api/dashboard/layout',
    '/api/expenses',
    '/metrics',
  ];

  it.each(SAMPLE_PATHS)('%s carries the security headers', async (path) => {
    const res = await request(app).get(path);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('a 404 carries them too', async () => {
    // The error path is served by the same stack, and an attacker probing for
    // routes gets 404s — which is exactly when a missing `nosniff` matters.
    const res = await request(app).get('/api/no-such-thing');

    expect(res.status).toBe(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('every mounted router is imported (#896)', () => {
  it('no path in the route table refers to an undefined router', () => {
    // The generic form of the bug rather than the instance of it. Reading the
    // source is the only way to assert this: a router that is mounted but not
    // imported does not produce a missing route, it produces a module that
    // cannot be evaluated — so by the time a request could be made, the process
    // is already gone.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf8',
    );

    const mounted = [...source.matchAll(/app\.use\(\s*'[^']*',\s*(\w+)\s*\)/g)]
      .map((m) => m[1])
      .filter((name) => name.endsWith('Routes'));

    expect(mounted.length).toBeGreaterThan(15);

    for (const name of mounted) {
      expect(source).toMatch(new RegExp(`const\\s+${name}\\s*=\\s*require\\(`));
    }
  });

  it('imports nothing it does not use', () => {
    // The other half of the same reconstruction: `helmet` and `morgan` sat in
    // the require block for the life of the file without ever being called, and
    // an unused import is what a missing `app.use` looks like from the outside.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf8',
    );

    // Comments describe the history and legitimately name things the code no
    // longer uses, so they are stripped before the check.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    const imported = [...code.matchAll(/const\s+(\w+)\s*=\s*require\(/g)].map(
      (m) => m[1],
    );

    for (const name of imported) {
      const uses = [...code.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length;

      // One for the declaration, so anything used has at least two.
      expect({ name, uses }).toEqual({ name: name, uses: expect.any(Number) });
      expect(uses).toBeGreaterThan(1);
    }
  });
});

describe('request logging (#896)', () => {
  it('is mounted, and silent under test', () => {
    // `morgan` was imported and never called, so there was no access log at
    // all — which is why a deployed environment's logs could not say whether
    // any of the boot failures were ever reached. #723 wrote `requestLogger` to
    // replace morgan and did not mount it either.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'app.js'),
      'utf8',
    );

    expect(source).toMatch(/app\.use\(requestLogger\)/);
    expect(source).toMatch(/NODE_ENV !== 'test'/);
  });

  it('does not log during this suite', async () => {
    const logger = require('../utils/logger');
    const spy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    await request(app).get('/');

    expect(spy).not.toHaveBeenCalledWith('HTTP Request', expect.anything());
    spy.mockRestore();
  });
});
