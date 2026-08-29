const request = require('supertest');

jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: () => 'TESTSECRET',
    keyuri: () => 'otpauth://totp/test',
    verify: () => false,
  },
}));

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

describe('Global error handling middleware', () => {
  let app;

  beforeAll(() => {
    app = require('../app');
  });

  it('handles JSON parsing SyntaxErrors by returning 400 JSON response', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "test@example.com", "password": }'); // Malformed JSON

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid JSON payload format' });
  });

  it('handles CORS errors by returning 403 JSON response', async () => {
    const res = await request(app)
      .get('/')
      .set('Origin', 'http://unauthorized-domain.com');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'CORS not allowed' });
  });
});
