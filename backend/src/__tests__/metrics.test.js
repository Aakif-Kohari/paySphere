/**
 * The /metrics endpoint is the scrape target for Prometheus (issue #765).
 *
 * It is deliberately public (scrapers carry no auth token), so unlike every
 * /api route it must answer 200 without credentials. The response is the
 * Prometheus text exposition format — a content-type header plus one or more
 * metric families.
 */

const request = require('supertest');

// Same stub rationale as app.routeMounting.test.js: the rate limiters are
// IP-keyed and stateful, so a suite firing repeated requests 429s on the
// second run.
jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  authRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
  standardLimiter: (req, res, next) => next(),
  strictLimiter: (req, res, next) => next(),
}));

// Same otplib ESM-transpile rationale as app.routeMounting.test.js.
jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: () => 'TESTSECRET',
    keyuri: () => 'otpauth://totp/test',
    verify: () => false,
  },
}));

const app = require('../app');

describe('GET /metrics (#765)', () => {
  it('answers 200 without authentication', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
  });

  it('serves the Prometheus text format', async () => {
    const res = await request(app).get('/metrics');

    expect(res.headers['content-type']).toContain('text/plain');
    // A metric family in exposition format: name, HELP, TYPE, sample line.
    expect(res.text).toMatch(/^# HELP /m);
    expect(res.text).toMatch(/^# TYPE /m);
  });

  it('exposes the HTTP request metrics used by the Grafana dashboard', async () => {
    // Fire a request first so http_requests_total has at least one sample.
    await request(app).get('/metrics');

    const res = await request(app).get('/metrics');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds_bucket');
  });
});
