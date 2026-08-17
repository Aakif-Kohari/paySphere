/**
 * `auth.middleware` — bearer-token parsing and tenant resolution (#1008).
 *
 * The behavioural contract of this middleware is already covered by
 * `auth.middleware.test.js` (the 401 paths) and `auth.tenant.middleware.test.js`
 * (how `req.tenantId` is chosen). Neither of those suites had ever run: the
 * middleware was a `.ts` file, Babel is configured with `@babel/preset-env` and
 * no TypeScript preset, and both suites reported "failed to run" rather than
 * "failed". Converting the module to CommonJS is what let them execute, and
 * they both pass unchanged — which is the evidence that the conversion
 * preserved behaviour rather than reimplemented it.
 *
 * This file covers the two seams the conversion introduced. `extractBearerToken`
 * and `resolveTenantId` were expressions inline in the handler before; pulling
 * them out is only an improvement if they are pinned down, and header parsing in
 * particular is the kind of thing that looks obviously correct and is not.
 */

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

const { extractBearerToken, resolveTenantId, AUTH_USER_PROJECTION } = auth;

const anId = () => new mongoose.Types.ObjectId();

describe('extractBearerToken', () => {
  const withHeader = (authorization) => ({ headers: { authorization } });

  it('reads a well-formed header', () => {
    expect(extractBearerToken(withHeader('Bearer abc.def.ghi'))).toBe(
      'abc.def.ghi',
    );
  });

  it('accepts any casing of the scheme', () => {
    // Case-insensitive per RFC 7235. Clients do send `bearer`.
    expect(extractBearerToken(withHeader('bearer token'))).toBe('token');
    expect(extractBearerToken(withHeader('BEARER token'))).toBe('token');
  });

  it('tolerates extra whitespace around the scheme', () => {
    // `split(' ')[1]` — what this replaced — returns '' for a double space and
    // then the caller treats an empty string as a token and hands it to
    // jwt.verify, producing "Invalid or expired token" for what is really a
    // malformed header.
    expect(extractBearerToken(withHeader('Bearer   token'))).toBe('token');
    expect(extractBearerToken(withHeader('  Bearer token  '))).toBe('token');
    expect(extractBearerToken(withHeader('Bearer\ttoken'))).toBe('token');
  });

  it('returns null when there is no header at all', () => {
    expect(extractBearerToken({ headers: {} })).toBeNull();
    expect(extractBearerToken({})).toBeNull();
  });

  it('returns null for a non-bearer scheme', () => {
    // `Basic dXNlcjpwYXNz` should read as "no token provided", not as a token
    // that happens to fail verification — the two produce different messages
    // and only one of them is honest.
    expect(extractBearerToken(withHeader('Basic dXNlcjpwYXNz'))).toBeNull();
    expect(extractBearerToken(withHeader('Digest abc'))).toBeNull();
  });

  it('returns null for a scheme with nothing after it', () => {
    expect(extractBearerToken(withHeader('Bearer'))).toBeNull();
    expect(extractBearerToken(withHeader('Bearer   '))).toBeNull();
  });

  it('returns null for a bare token with no scheme', () => {
    expect(extractBearerToken(withHeader('abc.def.ghi'))).toBeNull();
  });

  it('ignores a non-string header', () => {
    // Node gives an array when a header appears twice in the request.
    expect(extractBearerToken({ headers: { authorization: ['a', 'b'] } })).toBe(
      null,
    );
    expect(extractBearerToken({ headers: { authorization: 42 } })).toBeNull();
  });
});

describe('resolveTenantId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureTenantForUser.mockResolvedValue(null);
  });

  it('prefers the account over the token claim', async () => {
    const current = anId();

    await expect(
      resolveTenantId({ tenantId: current }, { tenantId: anId().toString() }),
    ).resolves.toBe(current);
  });

  it('does not provision when the account is already scoped', async () => {
    await resolveTenantId({ tenantId: anId() }, {});

    expect(ensureTenantForUser).not.toHaveBeenCalled();
  });

  it('falls back to a usable token claim', async () => {
    const claimed = anId().toString();

    await expect(resolveTenantId({}, { tenantId: claimed })).resolves.toBe(
      claimed,
    );
    expect(ensureTenantForUser).not.toHaveBeenCalled();
  });

  it.each([
    ['the string "undefined"', 'undefined'],
    ['the string "null"', 'null'],
    ['an empty string', ''],
    ['a non-ObjectId', 'not-an-object-id'],
    ['undefined', undefined],
    ['null', null],
  ])('ignores %s as a claim and provisions instead', async (_label, claim) => {
    // `"undefined"` is what interpolating a missing id into a template
    // literal produces. It casts cleanly enough to look like a real value and
    // would otherwise be handed straight to a query filter.
    const provisioned = anId();
    ensureTenantForUser.mockResolvedValue(provisioned);

    await expect(resolveTenantId({}, { tenantId: claim })).resolves.toBe(
      provisioned,
    );
  });

  it('returns null rather than throwing when nothing can be resolved', async () => {
    // The refusal belongs at the scoped query (utils/tenantScope.js), not
    // here: 401 at this point would sign people out of endpoints that are not
    // tenant-scoped at all, such as reading their own settings.
    await expect(resolveTenantId({}, {})).resolves.toBeNull();
  });

  it('normalises a falsy provisioning result to null', async () => {
    ensureTenantForUser.mockResolvedValue(undefined);

    await expect(resolveTenantId({}, {})).resolves.toBeNull();
  });
});

describe('AUTH_USER_PROJECTION', () => {
  it('selects the fields tenant resolution and RBAC depend on', () => {
    // Trimming this projection is a tempting micro-optimisation and a silent
    // breakage: `tenantId` is what resolution prefers over the claim, and
    // `companyName` is what a newly provisioned tenant is named after.
    for (const field of [
      '_id',
      'isActive',
      'tokenVersion',
      'accountType',
      'employeeId',
      'tenantId',
      'companyName',
    ]) {
      expect(AUTH_USER_PROJECTION).toContain(field);
    }
  });
});

describe('auth middleware — header handling end to end', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    ensureTenantForUser.mockResolvedValue(null);
  });

  it('answers "No token provided" for a Basic auth header', async () => {
    req.headers.authorization = 'Basic dXNlcjpwYXNz';

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token provided' });
    // Never reached the verifier: there was no bearer token to verify.
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('does not leak why a token was rejected', async () => {
    req.headers.authorization = 'Bearer expired.token.here';
    jwt.verify.mockImplementation(() => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      throw error;
    });

    await auth(req, res, next);

    // Distinguishing "expired" from "malformed" from "bad signature" tells an
    // attacker which half of a forged token to keep working on.
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid or expired token',
    });
  });

  it('passes a valid request through with tenant and account type set', async () => {
    const tenantId = anId();
    req.headers.authorization = 'Bearer good';
    jwt.verify.mockReturnValue({ id: 'user123', tokenVersion: 0 });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: 'user123',
        isActive: true,
        tokenVersion: 0,
        tenantId,
      }),
    });

    await auth(req, res, next);

    expect(req.userId).toBe('user123');
    expect(req.tenantId).toBe(tenantId);
    expect(req.accountType).toBe('ADMIN');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('treats a login bound to an employee record as an employee', async () => {
    req.headers.authorization = 'Bearer good';
    jwt.verify.mockReturnValue({ id: 'user123', tokenVersion: 0 });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: 'user123',
        isActive: true,
        tokenVersion: 0,
        tenantId: anId(),
        employeeId: anId(),
      }),
    });

    await auth(req, res, next);

    // `resolveAccountType` keys off `employeeId` rather than defaulting to
    // ADMIN — the fail-open default #558 removed.
    expect(req.accountType).toBe('EMPLOYEE');
  });

  it('allows a token that predates tokenVersion', async () => {
    req.headers.authorization = 'Bearer good';
    // No tokenVersion claim at all: an old token, not a revoked one.
    jwt.verify.mockReturnValue({ id: 'user123' });
    User.findById.mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue({ _id: 'user123', isActive: true, tokenVersion: 2 }),
    });

    await auth(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
