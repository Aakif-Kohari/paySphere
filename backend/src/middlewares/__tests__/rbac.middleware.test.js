const authorize = require('../rbac.middleware');

describe('RBAC Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('should return 401 if user is not attached to request', () => {
    req.user = null;
    const middleware = authorize('EMPLOYEE');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 if user role is not authorized', () => {
    req.user = { role: 'EMPLOYEE' };
    const middleware = authorize('ADMIN');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied. Insufficient permissions.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next() if user role is allowed', () => {
    req.user = { role: 'EMPLOYEE' };
    const middleware = authorize('EMPLOYEE', 'ADMIN');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should default role to ADMIN if user has no role defined', () => {
    req.user = {};
    const middleware = authorize('ADMIN');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
