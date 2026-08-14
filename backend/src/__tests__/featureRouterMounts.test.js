/**
 * The eleven routers mounted in #1009, checked against the URLs the frontend
 * actually calls.
 *
 * `app.routeMounting.test.js` answers "is this router reachable at all". This
 * file answers the question that decided the mount paths: does the URL a page
 * already sends resolve to a handler?
 *
 * That distinction matters because a mount can be reachable and still wrong.
 * `clientInvoice.routes.js` defines `/invoices/dashboard` internally, so
 * mounting it at the obvious-looking `/api/client-invoices` would have produced
 * `/api/client-invoices/invoices/dashboard` — a perfectly reachable router, and
 * a 404 for `ClientInvoices.jsx`, which calls `/api/clients/invoices/dashboard`.
 * `shiftRoster` and `forecast` have the same trap. Nothing would have caught
 * that except asserting the two ends against each other, so that is what this
 * does.
 *
 * The URLs below were read out of the pages, not invented here:
 *
 *     frontend/src/pages/Assets.jsx              → /api/assets
 *     frontend/src/pages/Vendors.jsx             → /api/vendors
 *     frontend/src/pages/GrievancePortal.jsx     → /api/grievances/file
 *     frontend/src/pages/TaxProofPortal.jsx      → /api/tax-proofs/my-proofs
 *     frontend/src/pages/TaxVerificationQueue.jsx→ /api/tax-proofs/queue
 *     frontend/src/pages/AppraisalDashboard.jsx  → /api/appraisals/my-review
 *     frontend/src/pages/OfferLetterBuilder.jsx  → /api/contracts/issue
 *     frontend/src/pages/BudgetPlanner.jsx       → /api/forecasts/generate
 *     frontend/src/pages/AccountingExport.jsx    → /api/accounting/mappings
 *     frontend/src/pages/ClientInvoices.jsx      → /api/clients/invoices/dashboard
 *     frontend/src/pages/Roster.jsx              → /api/shifts/roster
 */

const request = require('supertest');

jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  authRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
  standardLimiter: (req, res, next) => next(),
  strictLimiter: (req, res, next) => next(),
}));

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

const app = require('../app');

/**
 * [description, method, url the frontend sends]
 */
const FRONTEND_CALLS = [
  ['Assets.jsx lists assets', 'get', '/api/assets'],
  ['Vendors.jsx registers a vendor', 'post', '/api/vendors'],
  [
    'GrievancePortal.jsx files a POSH complaint',
    'post',
    '/api/grievances/file',
  ],
  [
    'TaxProofPortal.jsx reads its own proofs',
    'get',
    '/api/tax-proofs/my-proofs',
  ],
  ['TaxVerificationQueue.jsx reads the queue', 'get', '/api/tax-proofs/queue'],
  [
    'AppraisalDashboard.jsx reads its own review',
    'get',
    '/api/appraisals/my-review',
  ],
  ['OfferLetterBuilder.jsx issues a contract', 'post', '/api/contracts/issue'],
  ['BudgetPlanner.jsx generates a forecast', 'post', '/api/forecasts/generate'],
  [
    'AccountingExport.jsx reads ledger mappings',
    'get',
    '/api/accounting/mappings',
  ],
  [
    'ClientInvoices.jsx reads the invoice dashboard',
    'get',
    '/api/clients/invoices/dashboard',
  ],
  ['Roster.jsx reads the roster', 'get', '/api/shifts/roster'],
];

const send = (method, url) =>
  method === 'post'
    ? request(app)[method](url).send({ probe: true })
    : request(app)[method](url);

describe('feature routers mounted in #1009', () => {
  describe.each(FRONTEND_CALLS)('%s', (_label, method, url) => {
    it(`${method.toUpperCase()} ${url} resolves to a handler`, async () => {
      const res = await send(method, url);

      // 401 is a pass. The router is mounted, auth ran, and the anonymous
      // caller was turned away — which is the whole of what "mounted" means
      // here. 404 is the failure this issue was about.
      expect(res.status).not.toBe(404);
    });

    it(`${method.toUpperCase()} ${url} refuses an anonymous caller`, async () => {
      const res = await send(method, url);

      // Mounting a router below the middleware stack is only half the job;
      // #663 is the precedent for a route that was reachable *and* unguarded.
      // Every one of these handles employee, payroll or statutory data.
      expect([401, 403]).toContain(res.status);
    });
  });

  it('carries the security headers on the new routes', async () => {
    // The mounts sit below Helmet, like everything else added since #896. A
    // router added above the middleware stack would answer without these —
    // the exact defect #663 fixed for /api/dashboard.
    const res = await request(app).get('/api/assets');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does not shadow an existing mount', async () => {
    // `/api/clients` and `/api/shifts` are new prefixes and `/api/forecasts` is
    // adjacent to `/api/reports`, which already carries two routers. Express
    // serves the first match, so a prefix collision would silently take traffic
    // from whichever router is mounted later.
    const stillWorking = [
      ['get', '/api/reports/analytics'],
      ['get', '/api/employees'],
      ['get', '/api/payroll/summary'],
    ];

    for (const [method, url] of stillWorking) {
      const res = await send(method, url);
      expect(res.status).not.toBe(404);
    }
  });

  it('leaves the POSH endpoints behind the ICC check, not plain RBAC', async () => {
    // `grievance.routes.js` deliberately bypasses `requirePermission` in favour
    // of `requireICC`, which checks active committee membership scoped to the
    // tenant and locks out admins for anti-retaliation reasons. Mounting the
    // router must not quietly change who can reach it.
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'routes', 'grievance.routes.js'),
      'utf8',
    );

    expect(source).toContain('requireICC');
    expect(source).not.toContain('requirePermission');
  });
});
