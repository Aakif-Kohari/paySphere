/**
 * GraphQL authentication (#795).
 *
 * `/graphql` was mounted with no auth middleware and resolvers that read the
 * whole collection, so an anonymous POST returned every company's employees and
 * payroll. These assertions are about the gate itself: no token, no data — and
 * no *scope*, no data either, because an unscoped mongoose filter reads
 * everything rather than nothing.
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

jest.mock('../../models/user.model');
jest.mock('../../services/tenant.service', () => ({
  ensureTenantForUser: jest.fn().mockResolvedValue(null),
}));

const User = require('../../models/user.model');
const { ensureTenantForUser } = require('../../services/tenant.service');
const { buildContext } = require('../context');

const SECRET = 'test-secret';
const USER_ID = new mongoose.Types.ObjectId();
const TENANT_ID = new mongoose.Types.ObjectId();

const withToken = (payload) => ({
  req: {
    headers: {
      authorization: `Bearer ${jwt.sign(payload, SECRET)}`,
    },
  },
});

const activeUser = (overrides = {}) => ({
  _id: USER_ID,
  isActive: true,
  tokenVersion: 0,
  tenantId: TENANT_ID,
  employeeId: null,
  ...overrides,
});

/** `User.findById(...).select(...)` */
const findByIdReturns = (doc) => {
  User.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue(doc),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = SECRET;
  ensureTenantForUser.mockResolvedValue(null);
});

describe('an anonymous caller gets nothing (#795)', () => {
  it.each([
    ['no Authorization header', {}],
    ['an empty Authorization header', { authorization: '' }],
    ['a non-Bearer scheme', { authorization: 'Basic abc123' }],
    ['Bearer with no token', { authorization: 'Bearer ' }],
  ])('is refused with %s', async (_label, headers) => {
    await expect(buildContext({ req: { headers } })).rejects.toThrow(
      /no token/i,
    );
  });

  it('answers 401 rather than a 200 with an error in the body', async () => {
    // The distinction matters: a client that only checks the status code would
    // otherwise treat "unauthenticated" as success.
    await expect(buildContext({ req: { headers: {} } })).rejects.toMatchObject({
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  });

  it('is refused with a token signed by somebody else', async () => {
    const forged = jwt.sign({ id: String(USER_ID) }, 'not-the-secret');

    await expect(
      buildContext({ req: { headers: { authorization: `Bearer ${forged}` } } }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  it('is refused with an expired token', async () => {
    const expired = jwt.sign({ id: String(USER_ID) }, SECRET, {
      expiresIn: '-1s',
    });

    await expect(
      buildContext({
        req: { headers: { authorization: `Bearer ${expired}` } },
      }),
    ).rejects.toThrow(/invalid or expired/i);
  });
});

describe('the account behind the token (#795)', () => {
  it('is refused when the user no longer exists', async () => {
    findByIdReturns(null);

    await expect(
      buildContext(withToken({ id: String(USER_ID) })),
    ).rejects.toThrow(/not found or deactivated/i);
  });

  it('is refused when the account is deactivated', async () => {
    findByIdReturns(activeUser({ isActive: false }));

    await expect(
      buildContext(withToken({ id: String(USER_ID) })),
    ).rejects.toThrow(/not found or deactivated/i);
  });

  it('is refused when the token version is stale', async () => {
    // A password change or a sign-out-everywhere bumps tokenVersion. Leaving
    // this check out of the GraphQL path would leave a revoked session working
    // on one endpoint and dead on all the others.
    findByIdReturns(activeUser({ tokenVersion: 2 }));

    await expect(
      buildContext(withToken({ id: String(USER_ID), tokenVersion: 1 })),
    ).rejects.toThrow(/no longer valid/i);
  });
});

describe('scope (#795)', () => {
  it('takes the tenant from the account, not from the token', async () => {
    // Refresh tokens live seven days, so a claim can be a week out of date. The
    // account is the authority (#612).
    findByIdReturns(activeUser({ tenantId: TENANT_ID }));

    const other = new mongoose.Types.ObjectId();
    const context = await buildContext(
      withToken({ id: String(USER_ID), tenantId: String(other) }),
    );

    expect(String(context.tenantId)).toBe(String(TENANT_ID));
  });

  it('falls back to the token claim when the account has none', async () => {
    findByIdReturns(activeUser({ tenantId: null }));

    const context = await buildContext(
      withToken({ id: String(USER_ID), tenantId: String(TENANT_ID) }),
    );

    expect(String(context.tenantId)).toBe(String(TENANT_ID));
  });

  it('provisions one for an account the migration has not reached', async () => {
    findByIdReturns(activeUser({ tenantId: null }));
    ensureTenantForUser.mockResolvedValue(TENANT_ID);

    const context = await buildContext(withToken({ id: String(USER_ID) }));

    expect(String(context.tenantId)).toBe(String(TENANT_ID));
  });

  it('refuses a request it cannot scope, rather than running unscoped', async () => {
    // This is the whole point. `Employee.find({ tenantId: undefined })` is not
    // a query that matches nothing — mongoose strips the key and it matches
    // every row in the collection, for every customer.
    findByIdReturns(activeUser({ tenantId: null }));
    ensureTenantForUser.mockResolvedValue(null);

    await expect(
      buildContext(withToken({ id: String(USER_ID) })),
    ).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  });

  it.each([undefined, null, '', 'undefined', 'null', 'not-an-objectid'])(
    'treats %p as no tenant at all',
    async (value) => {
      findByIdReturns(activeUser({ tenantId: value }));
      ensureTenantForUser.mockResolvedValue(value);

      await expect(
        buildContext(withToken({ id: String(USER_ID) })),
      ).rejects.toThrow(/not linked to a company/i);
    },
  );

  it('hands the resolvers a usable context on the happy path', async () => {
    findByIdReturns(activeUser());

    const context = await buildContext(withToken({ id: String(USER_ID) }));

    expect(context).toMatchObject({
      userId: String(USER_ID),
      tenantId: TENANT_ID,
    });
    expect(context.accountType).toBeTruthy();
  });
});
