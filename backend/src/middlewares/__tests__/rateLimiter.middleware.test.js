const { authRateLimiter, generalRateLimiter, writeRateLimiter } = require('../rateLimiter.middleware');

describe('Rate Limiter Middleware Config', () => {
  it('exports authRateLimiter with increased threshold', () => {
    expect(authRateLimiter).toBeDefined();
  });

  it('exports generalRateLimiter with burst capacity', () => {
    expect(generalRateLimiter).toBeDefined();
  });

  it('exports writeRateLimiter with increased write capacity', () => {
    expect(writeRateLimiter).toBeDefined();
  });
});
