const { generateCsrfToken, csrfProtection } = require('../csrf.middleware');

describe('CSRF Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      path: '/api/employees',
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
    next = jest.fn();
  });

  describe('generateCsrfToken', () => {
    it('should generate a signed CSRF token and set XSRF-TOKEN cookie', () => {
      generateCsrfToken(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'XSRF-TOKEN',
        expect.stringMatching(/^[a-f0-9]+\.[a-f0-9]+$/),
        expect.objectContaining({ path: '/' })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        csrfToken: expect.stringMatching(/^[a-f0-9]+\.[a-f0-9]+$/),
      });
    });
  });

  describe('csrfProtection', () => {
    it('should pass through safe GET requests without validation', () => {
      req.method = 'GET';
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through exempt login/register endpoints', () => {
      req.method = 'POST';
      req.path = '/api/auth/login';
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when Anti-CSRF token header is missing on POST', () => {
      req.method = 'POST';
      req.path = '/api/expenses';
      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('missing Anti-CSRF token'),
          code: 'EBADCSRFTOKEN',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for malformed token header', () => {
      req.method = 'POST';
      req.path = '/api/expenses';
      req.headers['x-csrf-token'] = 'invalid_token_without_signature';

      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Malformed Anti-CSRF token',
        })
      );
    });

    it('should pass through valid POST request with signed CSRF token', () => {
      // Mint token first
      generateCsrfToken(req, res);
      const mintedToken = res.json.mock.calls[0][0].csrfToken;

      req.method = 'POST';
      req.path = '/api/expenses';
      req.headers['x-csrf-token'] = mintedToken;
      req.cookies['XSRF-TOKEN'] = mintedToken;

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
