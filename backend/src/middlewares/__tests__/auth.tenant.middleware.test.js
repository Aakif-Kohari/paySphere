const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const auth = require('../auth.middleware');
const User = require('../../models/user.model');
const { ensureTenantForUser } = require('../../services/tenant.service');

jest.mock('../../models/user.model');
jest.mock('jsonwebtoken');
jest.mock('../../services/tenant.service', () => ({
  ensureTenantForUser: jest.fn(),
}));

const anId = () => new mongoose.Types.ObjectId();

/**
 * How the middleware resolves `req.tenantId` (#612).
 *
 * #585 read the claim straight off the JWT. Refresh tokens live seven days, so
 * a session opened before a tenant existed carried `tenantId: undefined` for a
 * week afterwards — and an undefined tenant is not a filter that matches
 * nothing, it is a key the driver drops when it encodes the query, which turns
 * every scoped read into an unscoped one.
 */
describe('auth.middleware — tenant resolution (#612)', () => {
  let req, res, next;

  const authenticateAs = (user, claims = {}) => {
    req.headers.authorization = 'Bearer token';
    jwt.verify.mockReturnValue({ id: 'user123', tokenVersion: 0, ...claims });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
  };

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    jest.clearAllMocks();
    ensureTenantForUser.mockResolvedValue(null);
  });

  test('prefers the tenant on the account over the one in the token', async () => {
    const current = anId();
    const stale = anId();

    authenticateAs({ _id: anId(), isActive: true, tenantId: current }, { tenantId: stale });

    await auth(req, res, next);

    expect(req.tenantId).toBe(current);
    expect(next).toHaveBeenCalled();
  });

  test('a tenant assigned since the token was issued takes effect on the next request', async () => {
    const tenantId = anId();

    // The token predates provisioning entirely — no claim at all.
    authenticateAs({ _id: anId(), isActive: true, tenantId }, { tenantId: undefined });

    await auth(req, res, next);

    expect(req.tenantId).toBe(tenantId);
  });

  test('falls back to the token claim when the account row has no tenant', async () => {
    const claimed = anId().toString();

    authenticateAs({ _id: anId(), isActive: true }, { tenantId: claimed });

    await auth(req, res, next);

    expect(req.tenantId).toBe(claimed);
  });

  test('ignores an unusable claim rather than passing it downstream', async () => {
    authenticateAs({ _id: anId(), isActive: true }, { tenantId: 'undefined' });

    await auth(req, res, next);

    // `"undefined"` is what interpolating a missing id produces. It must not
    // become a filter value.
    expect(req.tenantId).not.toBe('undefined');
  });

  test('provisions a tenant for an account the migration has not reached', async () => {
    const provisioned = anId();
    ensureTenantForUser.mockResolvedValue(provisioned);

    authenticateAs({ _id: anId(), isActive: true }, { tenantId: undefined });

    await auth(req, res, next);

    expect(ensureTenantForUser).toHaveBeenCalled();
    expect(req.tenantId).toBe(provisioned);
  });

  test('does not touch provisioning when the account is already scoped', async () => {
    authenticateAs({ _id: anId(), isActive: true, tenantId: anId() });

    await auth(req, res, next);

    // This runs on every authenticated request; it must not cost a write.
    expect(ensureTenantForUser).not.toHaveBeenCalled();
  });

  test('lets the request through unscoped rather than failing it, so tenantScope can refuse it', async () => {
    authenticateAs({ _id: anId(), isActive: true }, { tenantId: undefined });

    await auth(req, res, next);

    expect(req.tenantId).toBeNull();
    expect(next).toHaveBeenCalled();
    // 401 here would log people out of endpoints that are not tenant-scoped at
    // all, such as reading their own settings. The refusal belongs at the
    // scoped query, which is what utils/tenantScope.js does.
    expect(res.status).not.toHaveBeenCalledWith(401);
  });

  test('a provisioning failure does not take authentication down with it', async () => {
    ensureTenantForUser.mockRejectedValue(new Error('connection lost'));

    authenticateAs({ _id: anId(), isActive: true }, { tenantId: undefined });

    await auth(req, res, next);

    // The service swallows its own errors, but if that ever changes, the
    // middleware must not turn it into a 401 storm across every session.
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('selects the fields tenant resolution needs', async () => {
    const select = jest.fn().mockResolvedValue({ _id: anId(), isActive: true });
    req.headers.authorization = 'Bearer token';
    jwt.verify.mockReturnValue({ id: 'user123', tokenVersion: 0 });
    User.findById.mockReturnValue({ select });

    await auth(req, res, next);

    const projection = select.mock.calls[0][0];
    expect(projection).toContain('tenantId');
    // `companyName` is what a newly provisioned tenant is named after.
    expect(projection).toContain('companyName');
  });
});
