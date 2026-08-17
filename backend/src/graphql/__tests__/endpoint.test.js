/**
 * The /graphql endpoint over HTTP (#795).
 *
 * The unit suites cover the context function and the resolvers separately. This
 * one boots a real Apollo server through `attachGraphQL` and posts to it, which
 * is the only way to be sure the two are actually wired together — the whole
 * bug was that a correct-looking schema was mounted with nothing in front of it.
 *
 *     curl -s localhost:5000/graphql -d '{"query":"{ employees { email } }"}'
 *     → 200, every employee of every tenant
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

jest.mock('../../models/employee.model');
jest.mock('../../models/user.model');
jest.mock('../../models/payroll.model', () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
  collection: { name: 'payrollupdates' },
}));
jest.mock('../../services/tenant.service', () => ({
  ensureTenantForUser: jest.fn().mockResolvedValue(null),
}));

const Employee = require('../../models/employee.model');
const Payroll = require('../../models/payroll.model');
const User = require('../../models/user.model');
const { attachGraphQL, isGraphQLAvailable } = require('..');

const SECRET = 'test-secret';
const USER_ID = new mongoose.Types.ObjectId();
const TENANT = new mongoose.Types.ObjectId();
const OTHER_TENANT = new mongoose.Types.ObjectId();

const chain = (rows) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(rows),
});

const tokenFor = (tenantId = TENANT) =>
  jwt.sign({ id: String(USER_ID), tenantId: String(tenantId) }, SECRET);

let app;

// The packages are declared in backend/package.json as of this change, but the
// mount is guarded so the API still boots without them — so is the suite.
const describeIfAvailable = isGraphQLAvailable() ? describe : describe.skip;

describeIfAvailable('POST /graphql', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;

    app = express();
    await attachGraphQL(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    User.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: USER_ID,
        isActive: true,
        tokenVersion: 0,
        tenantId: TENANT,
      }),
    });

    Employee.find = jest.fn().mockReturnValue(
      chain([
        {
          _id: new mongoose.Types.ObjectId(),
          fullName: 'Alice Smith',
          email: 'alice@example.com',
          department: 'Engineering',
          isActive: true,
        },
      ]),
    );
    Employee.aggregate = jest.fn().mockResolvedValue([]);
    Employee.collection = { name: 'employees' };
    Payroll.find.mockReturnValue(chain([]));
    Payroll.aggregate.mockResolvedValue([]);
  });

  const post = (query, token) => {
    const req = request(app).post('/graphql').send({ query });
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('refuses an anonymous query and returns no data', async () => {
    const res = await post('{ employees { id email } }');

    expect(res.status).toBe(401);
    expect(res.body.data).toBeFalsy();
    expect(Employee.find).not.toHaveBeenCalled();
  });

  it('refuses an anonymous payroll query too', async () => {
    const res = await post('{ payrolls { netSalary employeeName } }');

    expect(res.status).toBe(401);
    expect(Payroll.find).not.toHaveBeenCalled();
  });

  it('answers an authenticated query with real values', async () => {
    const res = await post(
      '{ employees { fullName email department } }',
      tokenFor(),
    );

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.employees[0]).toEqual({
      fullName: 'Alice Smith',
      email: 'alice@example.com',
      department: 'Engineering',
    });
  });

  it('scopes the query to the tenant on the account', async () => {
    // The token claims a different tenant on purpose: the account is the
    // authority, so the claim must not be able to redirect the scope.
    await post('{ employees { fullName } }', tokenFor(OTHER_TENANT));

    expect(String(Employee.find.mock.calls[0][0].tenantId)).toBe(
      String(TENANT),
    );
  });

  it('does not expose a tenant argument to point somewhere else', async () => {
    const res = await post(
      `{ employees(tenantId: "${OTHER_TENANT}") { fullName } }`,
      tokenFor(),
    );

    // Rejected by the schema itself — there is no such argument.
    expect(res.body.errors[0].message).toMatch(/unknown argument/i);
  });
});
