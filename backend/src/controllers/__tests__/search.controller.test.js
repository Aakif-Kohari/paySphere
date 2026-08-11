jest.mock('../../services/elasticsearch.service', () => ({
  INDICES: {
    EMPLOYEES: 'paysphere-employees',
    PAYROLL: 'paysphere-payroll',
    AUDIT: 'paysphere-audit-logs',
  },
  search: jest.fn().mockResolvedValue([]),
  isSearchAvailable: jest.fn().mockReturnValue(true),
}));

const {
  globalSearch,
  permissionForRequest,
  SEARCHABLE_INDICES,
  MAX_QUERY_LENGTH,
} = require('../search.controller');
const {
  search,
  isSearchAvailable,
} = require('../../services/elasticsearch.service');
const { PERMISSIONS } = require('../../config/permissions');

const TENANT = '507f1f77bcf86cd799439011';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (query = {}, overrides = {}) => ({
  query,
  tenantId: TENANT,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  search.mockResolvedValue([]);
  isSearchAvailable.mockReturnValue(true);
});

/**
 * `globalSearch` (#895).
 *
 * The handler used to read a term off the query string and hand it to a service
 * that searched a whole index. There was no tenant anywhere in the path — not
 * in the handler, not in the service signature — so any authenticated caller
 * could read every company's records.
 */

describe('tenancy (#895)', () => {
  test('the caller tenant is passed down to the search', async () => {
    await globalSearch(makeReq({ q: 'priya' }), makeRes());

    expect(search).toHaveBeenCalledWith(
      'paysphere-employees',
      'priya',
      expect.objectContaining({ tenantId: TENANT }),
    );
  });

  test('an unscoped request is refused before it reaches the service', async () => {
    const res = makeRes();
    await globalSearch(makeReq({ q: 'priya' }, { tenantId: undefined }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(search).not.toHaveBeenCalled();
  });

  test('the refusal is a 403, not a 500', async () => {
    // `requireTenant` would have been the natural thing to call, and its
    // MissingTenantError sets `status = 403` — but error.middleware.js reads
    // `err.statusCode` and defaults it to 500, so the throw renders as a server
    // error. "Your account is not linked to a company" is not a crash.
    const res = makeRes();
    await globalSearch(makeReq({ q: 'priya' }, { tenantId: null }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  test('a malformed tenant is refused rather than passed through', async () => {
    const res = makeRes();
    await globalSearch(makeReq({ q: 'priya' }, { tenantId: 'not-an-id' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(search).not.toHaveBeenCalled();
  });

  test('a tenant in the query string cannot widen the scope', async () => {
    await globalSearch(
      makeReq({ q: 'priya', tenantId: '507f1f77bcf86cd799439099' }),
      makeRes(),
    );

    expect(search).toHaveBeenCalledWith(
      expect.any(String),
      'priya',
      expect.objectContaining({ tenantId: TENANT }),
    );
  });
});

describe('index selection', () => {
  test('defaults to employees', async () => {
    await globalSearch(makeReq({ q: 'priya' }), makeRes());

    expect(search.mock.calls[0][0]).toBe('paysphere-employees');
  });

  test('payroll is searchable', async () => {
    await globalSearch(makeReq({ q: '2026-07', index: 'payroll' }), makeRes());

    expect(search.mock.calls[0][0]).toBe('paysphere-payroll');
  });

  test('an unknown index is a 400 naming the valid ones', async () => {
    const res = makeRes();
    await globalSearch(makeReq({ q: 'priya', index: 'salaries' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/employees, payroll/);
  });

  test('the audit index is not searchable', async () => {
    // A full-text index of every action every user has taken should not become
    // readable by every token holder as a side effect of fixing a boot error.
    // There is no permission in the catalogue that means "may read audit logs"
    // to gate it with, and defining one belongs with gating the audit routes.
    const res = makeRes();
    await globalSearch(makeReq({ q: 'delete', index: 'audit-logs' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(search).not.toHaveBeenCalled();
  });

  test('index matching is case- and whitespace-insensitive', async () => {
    await globalSearch(makeReq({ q: 'x', index: '  PayRoll ' }), makeRes());

    expect(search.mock.calls[0][0]).toBe('paysphere-payroll');
  });
});

describe('the query term', () => {
  test('a missing term is a 400', async () => {
    const res = makeRes();
    await globalSearch(makeReq({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(search).not.toHaveBeenCalled();
  });

  test('a whitespace-only term is a 400', async () => {
    const res = makeRes();
    await globalSearch(makeReq({ q: '   ' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('an array of terms does not reach the service as an array', async () => {
    // `?q=a&q=b` gives an array. `String()` before `.trim()` is what keeps this
    // from throwing, and keeps a non-string out of the query body.
    await globalSearch(makeReq({ q: ['priya', 'sharma'] }), makeRes());

    expect(typeof search.mock.calls[0][1]).toBe('string');
  });

  test('an over-long term is refused rather than sent to the cluster', async () => {
    const res = makeRes();
    await globalSearch(makeReq({ q: 'x'.repeat(MAX_QUERY_LENGTH + 1) }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(search).not.toHaveBeenCalled();
  });

  test('a term at exactly the limit is accepted', async () => {
    await globalSearch(makeReq({ q: 'x'.repeat(MAX_QUERY_LENGTH) }), makeRes());

    expect(search).toHaveBeenCalled();
  });

  test('the term is trimmed before it is searched', async () => {
    await globalSearch(makeReq({ q: '  priya  ' }), makeRes());

    expect(search.mock.calls[0][1]).toBe('priya');
  });
});

describe('the response', () => {
  test('carries the results, the count and the index', async () => {
    search.mockResolvedValue([{ id: 'e1', score: 2, fullName: 'Priya' }]);
    const res = makeRes();

    await globalSearch(makeReq({ q: 'priya' }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ index: 'employees', query: 'priya', count: 1 }),
    );
  });

  test('says whether the search backend is actually running', async () => {
    // Without this, a company with no employees and a cluster that is down are
    // the same response, and there is no way for a caller to tell.
    isSearchAvailable.mockReturnValue(false);
    const res = makeRes();

    await globalSearch(makeReq({ q: 'priya' }), res);

    expect(res.json.mock.calls[0][0]).toMatchObject({
      available: false,
      results: [],
    });
  });

  test('a requested size is forwarded for the service to cap', async () => {
    await globalSearch(makeReq({ q: 'priya', size: '5' }), makeRes());

    expect(search.mock.calls[0][2]).toMatchObject({ size: '5' });
  });
});

describe('permissionForRequest (#895)', () => {
  test('employees maps to READ_EMPLOYEE', () => {
    expect(permissionForRequest({ query: { index: 'employees' } })).toBe(
      PERMISSIONS.READ_EMPLOYEE,
    );
  });

  test('payroll maps to READ_PAYROLL', () => {
    expect(permissionForRequest({ query: { index: 'payroll' } })).toBe(
      PERMISSIONS.READ_PAYROLL,
    );
  });

  test('an absent index maps to the default index permission', () => {
    expect(permissionForRequest({ query: {} })).toBe(PERMISSIONS.READ_EMPLOYEE);
    expect(permissionForRequest({})).toBe(PERMISSIONS.READ_EMPLOYEE);
  });

  test('an unknown index maps to no permission, so the route can refuse it', () => {
    expect(permissionForRequest({ query: { index: 'audit-logs' } })).toBeNull();
    expect(
      permissionForRequest({ query: { index: '../../etc/passwd' } }),
    ).toBeNull();
  });

  test('every searchable index declares a permission', () => {
    // The property that has to hold as indices are added: an index with no
    // declared permission is an index anyone can read.
    for (const [key, target] of Object.entries(SEARCHABLE_INDICES)) {
      expect(typeof target.permission).toBe('string');
      expect(target.permission.length).toBeGreaterThan(0);
      expect(typeof target.index).toBe('string');
      expect(key).toBe(key.toLowerCase());
    }
  });
});
