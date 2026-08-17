const ResponseFormatter = require('../../utils/responseFormatter');
const responseMiddleware = require('../response.middleware');

describe('Unified Response Formatter & Middleware (#1039)', () => {
  describe('ResponseFormatter Class', () => {
    test('success formats payload correctly', () => {
      const data = { id: 1, name: 'Sample' };
      const message = 'Successfully processed';
      const formatted = ResponseFormatter.success(data, message);

      expect(formatted).toEqual({
        success: true,
        data,
        message,
      });
    });

    test('success formats payload without message correctly', () => {
      const data = { token: 'xyz' };
      const formatted = ResponseFormatter.success(data);

      expect(formatted).toEqual({
        success: true,
        data,
      });
    });

    test('error formats structured payload correctly', () => {
      const message = 'Validation error occurred';
      const details = [{ field: 'email', issue: 'Invalid email' }];
      const code = 'VALIDATION_FAILED';
      const formatted = ResponseFormatter.error(message, details, code);

      expect(formatted).toEqual({
        success: false,
        error: {
          message,
          details,
          code,
        },
      });
    });
  });

  describe('responseMiddleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    test('should mount res.success and res.error, then call next', () => {
      responseMiddleware(req, res, next);

      expect(res.success).toBeDefined();
      expect(res.error).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    test('res.success sends correct status and standard structure', () => {
      responseMiddleware(req, res, next);

      const data = { userId: '123' };
      res.success(data, 'User found', 200);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        message: 'User found',
      });
    });

    test('res.error sends correct status and standard structure', () => {
      responseMiddleware(req, res, next);

      const message = 'Permission Denied';
      res.error(message, null, 'FORBIDDEN', 403);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message,
          code: 'FORBIDDEN',
        },
      });
    });
  });
});
