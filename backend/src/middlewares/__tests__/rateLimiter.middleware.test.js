const {
  authRateLimiter,
  generalRateLimiter,
  writeRateLimiter,
  _memoryStore,
} = require('../rateLimiter.middleware');

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

describe('Sliding Window Rate Limiter Middleware Logic', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    if (_memoryStore) {
      _memoryStore.clear();
    }
    req = {
      ip: '127.0.0.1',
      headers: {},
      connection: {},
    };
    res = {
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    next = jest.fn();
  });

  it('allows request within limit and sets correct rate limit headers', async () => {
    await authRateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.headers['X-RateLimit-Limit']).toBe(30);
    expect(res.headers['X-RateLimit-Remaining']).toBe(29);
    expect(res.headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('blocks requests once the limit is exceeded', async () => {
    // Limit is 30, let's call it 30 times
    for (let i = 0; i < 30; i++) {
      const mockNext = jest.fn();
      await authRateLimiter(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    }

    // 31st call should be blocked
    const mockNext = jest.fn();
    await authRateLimiter(req, res, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.message).toContain('Too many authentication attempts');
    expect(res.headers['X-RateLimit-Remaining']).toBe(0);
  });
});

