const mongoose = require('mongoose');
const Employee = require('../../models/employee.model');
const {
  getArchivedEmployees,
  getArchivedEmployee,
} = require('../archive.controller');

jest.mock('../../models/employee.model');

const oid = () => new mongoose.Types.ObjectId().toString();

const TENANT = oid();
const OTHER_TENANT = oid();
const USER = oid();
const EMPLOYEE_ID = oid();

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (overrides = {}) => ({
  query: {},
  params: {},
  userId: USER,
  tenantId: TENANT,
  ...overrides,
});

/**
 * `Employee.find(...).setOptions(...).sort(...).skip(...).limit(...)`, with the
 * options the chain was given recorded so a test can assert on them.
 */
const listChain = (rows) => {
  const chain = {
    options: null,
    setOptions: jest.fn(function (opts) {
      chain.options = opts;
      return chain;
    }),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  };

  return chain;
};

const countChain = (n) => ({
  setOptions: jest.fn().mockResolvedValue(n),
});

const archivedRow = (overrides = {}) => ({
  _id: EMPLOYEE_ID,
  fullName: 'Priya Sharma',
  isDeleted: true,
  deletedAt: new Date('2026-07-01'),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  Employee.find.mockReturnValue(listChain([archivedRow()]));
  Employee.countDocuments.mockReturnValue(countChain(1));
});

/**
 * The archive (#897).
 *
 * Three faults, and the first hid the other two: the query selected on
 * `isDeleted: true` and nothing in the product ever wrote that field, so the
 * endpoint returned `[]` for every account in every company since it shipped.
 * `employee.controller.test.js` covers the marker; this file covers the view.
 */

describe('scoping (#897)', () => {
  test('lists the company archive, not the caller own deletions', async () => {
    // `createdBy: req.userId` is the account id of the caller. PaySphere is
    // multi-admin, so everything Admin A archived was invisible to Admin B —
    // and the page renders the same EmptyState either way, so neither could
    // tell "nothing archived" from "archived by someone else".
    await getArchivedEmployees(makeReq(), makeRes());

    expect(Employee.find).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, isDeleted: true }),
    );
  });

  test('does not filter by the caller account id', async () => {
    await getArchivedEmployees(makeReq(), makeRes());

    expect(Employee.find.mock.calls[0][0]).not.toHaveProperty('createdBy');
  });

  test('an unscoped request is refused instead of querying', async () => {
    // A tenant-less filter is not a filter that matches nothing — mongoose
    // deletes the key, and the query becomes every company's archive (#612).
    const res = makeRes();
    await getArchivedEmployees(makeReq({ tenantId: undefined }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Employee.find).not.toHaveBeenCalled();
  });

  test('a malformed tenant is refused too', async () => {
    const res = makeRes();
    await getArchivedEmployees(makeReq({ tenantId: 'not-an-id' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Employee.find).not.toHaveBeenCalled();
  });

  test('a tenant in the query string cannot widen the scope', async () => {
    await getArchivedEmployees(
      makeReq({ query: { tenantId: OTHER_TENANT } }),
      makeRes(),
    );

    expect(Employee.find.mock.calls[0][0].tenantId).toBe(TENANT);
  });
});

describe('reading deleted rows at all (#897)', () => {
  test('the list opts out of the soft-delete plugin', async () => {
    // Every query hook in softDelete.plugin.js appends
    // `isDeleted: { $ne: true }`. An archive that does not opt out is an
    // archive that can only return records which are not archived.
    const chain = listChain([archivedRow()]);
    Employee.find.mockReturnValue(chain);

    await getArchivedEmployees(makeReq(), makeRes());

    expect(chain.setOptions).toHaveBeenCalledWith({ includeDeleted: true });
  });

  test('the count opts out as well', async () => {
    const count = countChain(3);
    Employee.countDocuments.mockReturnValue(count);

    await getArchivedEmployees(makeReq(), makeRes());

    expect(count.setOptions).toHaveBeenCalledWith({ includeDeleted: true });
  });

  test('rows are newest-deleted first', async () => {
    const chain = listChain([archivedRow()]);
    Employee.find.mockReturnValue(chain);

    await getArchivedEmployees(makeReq(), makeRes());

    expect(chain.sort).toHaveBeenCalledWith({ deletedAt: -1 });
  });
});

describe('pagination (#897)', () => {
  test('defaults to the first page and a bounded page size', async () => {
    const chain = listChain([]);
    Employee.find.mockReturnValue(chain);

    await getArchivedEmployees(makeReq(), makeRes());

    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  test('a requested page is honoured', async () => {
    const chain = listChain([]);
    Employee.find.mockReturnValue(chain);

    await getArchivedEmployees(makeReq({ query: { page: '3' } }), makeRes());

    expect(chain.skip).toHaveBeenCalledWith(40);
  });

  test('an oversized limit is capped', async () => {
    // The original had no limit at all, on a query returning whole employee
    // documents — salary, email, department — for the life of the company.
    const chain = listChain([]);
    Employee.find.mockReturnValue(chain);

    await getArchivedEmployees(
      makeReq({ query: { limit: '100000' } }),
      makeRes(),
    );

    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  test('a nonsense page falls back to the first rather than to NaN', async () => {
    const chain = listChain([]);
    Employee.find.mockReturnValue(chain);

    await getArchivedEmployees(
      makeReq({ query: { page: 'last', limit: '-4' } }),
      makeRes(),
    );

    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  test('the response carries a total so the UI can page and count', async () => {
    Employee.countDocuments.mockReturnValue(countChain(47));
    const res = makeRes();

    await getArchivedEmployees(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ total: 47, page: 1, limit: 20, totalPages: 3 }),
    );
  });

  test('an empty archive still reports one page rather than zero', async () => {
    Employee.countDocuments.mockReturnValue(countChain(0));
    Employee.find.mockReturnValue(listChain([]));
    const res = makeRes();

    await getArchivedEmployees(makeReq(), res);

    expect(res.json.mock.calls[0][0].totalPages).toBe(1);
  });

  test('the response shape the page already consumes is preserved', async () => {
    const res = makeRes();

    await getArchivedEmployees(makeReq(), res);

    expect(res.json.mock.calls[0][0]).toMatchObject({
      success: true,
      data: expect.any(Array),
    });
  });
});

describe('GET /archive/employees/:id (#897)', () => {
  test('returns one archived record, scoped', async () => {
    Employee.findOne.mockReturnValue({
      setOptions: jest.fn().mockResolvedValue(archivedRow()),
    });
    const res = makeRes();

    await getArchivedEmployee(makeReq({ params: { id: EMPLOYEE_ID } }), res);

    expect(Employee.findOne).toHaveBeenCalledWith({
      _id: EMPLOYEE_ID,
      tenantId: TENANT,
      isDeleted: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('another company record is a 404, not a 403', async () => {
    // A distinguishable "exists but not yours" is a way to confirm which
    // employee ids belong to another company.
    Employee.findOne.mockReturnValue({
      setOptions: jest.fn().mockResolvedValue(null),
    });
    const res = makeRes();

    await getArchivedEmployee(makeReq({ params: { id: EMPLOYEE_ID } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  test('a malformed id is a 400 before any query', async () => {
    const res = makeRes();

    await getArchivedEmployee(makeReq({ params: { id: 'nope' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Employee.findOne).not.toHaveBeenCalled();
  });

  test('an unscoped request is refused', async () => {
    const res = makeRes();

    await getArchivedEmployee(
      makeReq({ params: { id: EMPLOYEE_ID }, tenantId: null }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Employee.findOne).not.toHaveBeenCalled();
  });
});

describe('failures are passed on rather than swallowed', () => {
  test('a database error reaches the error handler', async () => {
    Employee.countDocuments.mockImplementation(() => {
      throw new Error('connection reset');
    });
    const next = jest.fn();

    await getArchivedEmployees(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
