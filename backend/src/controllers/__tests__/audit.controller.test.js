jest.mock('../../models/auditLog.model', () => {
  const model = {
    find: jest.fn(),
    countDocuments: jest.fn(),
  };
  model.AUDIT_ACTIONS = ['PAYROLL_APPROVE', 'EMPLOYEE_CREATE'];
  return model;
});

jest.mock('../../services/cache.service', () => ({
  get: jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue(true),
  generateHash: jest.fn().mockReturnValue('mock-hash'),
}));

const mongoose = require('mongoose');
const AuditLog = require('../../models/auditLog.model');
const {
  getAuditLogs,
  exportAuditLogsCSV,
  parseDateRange,
  MAX_PAGE_SIZE,
  MAX_EXPORT_ROWS,
} = require('../audit.controller');

const TENANT_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_USER_ID = new mongoose.Types.ObjectId().toString();

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  return res;
};

const buildReq = (query = {}, overrides = {}) => ({
  userId: USER_ID,
  tenantId: TENANT_ID,
  query,
  ...overrides,
});

/** A chainable mongoose Query stub that resolves to `rows`. */
const queryStub = (rows) => {
  const chain = {};
  for (const method of ['sort', 'populate', 'skip', 'limit']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.lean = jest.fn().mockResolvedValue(rows);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  AuditLog.find.mockReturnValue(queryStub([]));
  AuditLog.countDocuments.mockResolvedValue(0);
});

describe('getAuditLogs — scope (#664)', () => {
  test('filters by tenant, not by the caller', async () => {
    // The bug: `AuditLog.find({ userId: req.userId })` made the trail a
    // personal diary. An owner could not see the payroll run an HR manager
    // submitted, or the approval a second admin signed off.
    await getAuditLogs(buildReq(), buildRes(), jest.fn());

    const [filter] = AuditLog.find.mock.calls[0];
    expect(filter).toEqual({ tenantId: TENANT_ID });
    expect(filter.userId).toBeUndefined();
  });

  test('the count uses the same filter as the page', async () => {
    await getAuditLogs(buildReq(), buildRes(), jest.fn());

    expect(AuditLog.countDocuments).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
    });
  });

  test('?actor=<id> narrows to one person', async () => {
    await getAuditLogs(buildReq({ actor: OTHER_USER_ID }), buildRes(), jest.fn());

    expect(AuditLog.find.mock.calls[0][0]).toEqual({
      tenantId: TENANT_ID,
      userId: OTHER_USER_ID,
    });
  });

  test('?actor=me is the old single-user behaviour', async () => {
    await getAuditLogs(buildReq({ actor: 'me' }), buildRes(), jest.fn());

    expect(AuditLog.find.mock.calls[0][0].userId).toBe(USER_ID);
  });

  test('a request with no tenant is refused, not run unscoped', async () => {
    const next = jest.fn();

    await getAuditLogs(
      buildReq({}, { tenantId: undefined }),
      buildRes(),
      next,
    );

    expect(AuditLog.find).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MissingTenantError' }),
    );
  });

  test('resolves the actor so the UI does not render raw ObjectIds', async () => {
    const chain = queryStub([]);
    AuditLog.find.mockReturnValue(chain);

    await getAuditLogs(buildReq(), buildRes(), jest.fn());

    expect(chain.populate).toHaveBeenCalledWith('userId', 'fullName email');
  });

  test('handles null userId gracefully if user was deleted', async () => {
    const chain = queryStub([
      {
        createdAt: new Date('2026-08-01T10:00:00Z'),
        userId: null,
        action: 'PAYROLL_APPROVE',
      },
    ]);
    AuditLog.find.mockReturnValue(chain);

    const res = buildRes();
    await getAuditLogs(buildReq(), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        logs: [
          expect.objectContaining({
            userId: { fullName: 'Deleted User', email: '' },
          }),
        ],
      }),
    );
  });
});

describe('getAuditLogs — pagination (#664)', () => {
  test('defaults to page 1, 20 rows', async () => {
    const chain = queryStub([]);
    AuditLog.find.mockReturnValue(chain);

    await getAuditLogs(buildReq(), buildRes(), jest.fn());

    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  test('caps the page size', async () => {
    const chain = queryStub([]);
    AuditLog.find.mockReturnValue(chain);

    await getAuditLogs(buildReq({ limit: '100000' }), buildRes(), jest.fn());

    expect(chain.limit).toHaveBeenCalledWith(MAX_PAGE_SIZE);
  });

  test('a nonsense page or limit falls back to the defaults', async () => {
    const chain = queryStub([]);
    AuditLog.find.mockReturnValue(chain);

    await getAuditLogs(
      buildReq({ page: 'abc', limit: '-5' }),
      buildRes(),
      jest.fn(),
    );

    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  test('reports the page size it actually used', async () => {
    AuditLog.countDocuments.mockResolvedValue(45);
    const res = buildRes();

    await getAuditLogs(buildReq({ limit: '10', page: '2' }), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        totalLogs: 45,
        currentPage: 2,
        pageSize: 10,
        totalPages: 5,
      }),
    );
  });
});

describe('getAuditLogs — filters (#664)', () => {
  test('rejects an unknown action with a 400', async () => {
    const res = buildRes();

    await getAuditLogs(buildReq({ action: 'NOT_A_THING' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(AuditLog.find).not.toHaveBeenCalled();
  });

  test('accepts a known action', async () => {
    await getAuditLogs(
      buildReq({ action: 'PAYROLL_APPROVE' }),
      buildRes(),
      jest.fn(),
    );

    expect(AuditLog.find.mock.calls[0][0].action).toBe('PAYROLL_APPROVE');
  });

  test('an unparseable date is a 400, not a cast error', async () => {
    const res = buildRes();

    await getAuditLogs(buildReq({ startDate: 'yesterday-ish' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('parseDateRange (#664)', () => {
  test('no range params means no clause', () => {
    expect(parseDateRange({})).toEqual({ ok: true, range: null });
  });

  test('builds a bounded range', () => {
    const result = parseDateRange({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(result.ok).toBe(true);
    expect(result.range.$gte).toEqual(new Date('2026-01-01'));
    expect(result.range.$lte).toEqual(new Date('2026-01-31'));
  });

  test('rejects a start after the end', () => {
    const result = parseDateRange({
      startDate: '2026-02-01',
      endDate: '2026-01-01',
    });

    expect(result.ok).toBe(false);
  });

  test('days builds a lower bound', () => {
    const result = parseDateRange({ days: '7' });

    expect(result.ok).toBe(true);
    expect(result.range.$gte).toBeInstanceOf(Date);
  });

  test('rejects a non-positive days', () => {
    expect(parseDateRange({ days: '0' }).ok).toBe(false);
    expect(parseDateRange({ days: 'lots' }).ok).toBe(false);
  });
});

describe('exportAuditLogsCSV (#664)', () => {
  test('exports the whole tenant, not just the caller', async () => {
    await exportAuditLogsCSV(buildReq(), buildRes(), jest.fn());

    expect(AuditLog.find.mock.calls[0][0]).toEqual({ tenantId: TENANT_ID });
  });

  test('bounds the export instead of loading the collection', async () => {
    const chain = queryStub([]);
    AuditLog.find.mockReturnValue(chain);

    await exportAuditLogsCSV(buildReq(), buildRes(), jest.fn());

    expect(chain.limit).toHaveBeenCalledWith(MAX_EXPORT_ROWS);
  });

  test('names the actor in the CSV', async () => {
    AuditLog.find.mockReturnValue(
      queryStub([
        {
          createdAt: new Date('2026-08-01T10:00:00Z'),
          userId: { fullName: 'Priya Nair', email: 'priya@acme.com' },
          action: 'PAYROLL_APPROVE',
          resourceType: 'Payroll',
          resourceIds: [],
          result: 'success',
          details: {},
        },
      ]),
    );

    const res = buildRes();
    await exportAuditLogsCSV(buildReq(), res, jest.fn());

    const csv = res.send.mock.calls[0][0];
    expect(csv).toContain('Actor');
    expect(csv).toContain('Priya Nair');
    expect(csv).toContain('priya@acme.com');
  });

  test('still neutralises a formula-injection payload', async () => {
    AuditLog.find.mockReturnValue(
      queryStub([
        {
          createdAt: new Date('2026-08-01T10:00:00Z'),
          userId: { fullName: '=cmd|calc', email: 'x@y.z' },
          action: 'PAYROLL_APPROVE',
          resourceType: 'Payroll',
          resourceIds: [],
          result: 'success',
          details: {},
        },
      ]),
    );

    const res = buildRes();
    await exportAuditLogsCSV(buildReq(), res, jest.fn());

    expect(res.send.mock.calls[0][0]).toContain("'=cmd|calc");
  });

  test('a request with no tenant is refused', async () => {
    const next = jest.fn();

    await exportAuditLogsCSV(
      buildReq({}, { tenantId: undefined }),
      buildRes(),
      next,
    );

    expect(AuditLog.find).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MissingTenantError' }),
    );
  });

  test('handles null userId in CSV export gracefully', async () => {
    const chain = queryStub([
      {
        createdAt: new Date('2026-08-01T10:00:00Z'),
        userId: null,
        action: 'PAYROLL_APPROVE',
        resourceType: 'Payroll',
        resourceIds: [],
        result: 'success',
        details: {},
      },
    ]);
    AuditLog.find.mockReturnValue(chain);

    const res = buildRes();
    await exportAuditLogsCSV(buildReq(), res, jest.fn());

    const csv = res.send.mock.calls[0][0];
    expect(csv).toContain('Deleted User');
  });
});

describe('getAuditLogs — Caching (#1094)', () => {
  const cacheService = require('../../services/cache.service');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return cached logs and skip DB query on cache hit', async () => {
    const cachedData = {
      logs: [{ action: 'CACHE_HIT', details: 'c-hit' }],
      metadata: { totalRecords: 1, totalPages: 1, currentPage: 1, pageSize: 50 },
    };
    cacheService.get.mockResolvedValueOnce(cachedData);

    const req = buildReq();
    const res = buildRes();
    
    await getAuditLogs(req, res, jest.fn());

    expect(cacheService.get).toHaveBeenCalled();
    expect(AuditLog.find).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: cachedData,
    });
  });

  test('should query DB and save to cache on cache miss', async () => {
    cacheService.get.mockResolvedValueOnce(null);
    AuditLog.find.mockReturnValue(queryStub([{ action: 'DB_READ' }]));
    AuditLog.countDocuments.mockResolvedValueOnce(1);

    const req = buildReq();
    const res = buildRes();

    await getAuditLogs(req, res, jest.fn());

    expect(cacheService.get).toHaveBeenCalled();
    expect(AuditLog.find).toHaveBeenCalled();
    expect(cacheService.setEx).toHaveBeenCalledWith(
      expect.stringContaining('audit:logs:'),
      60,
      expect.objectContaining({
        logs: expect.any(Array),
        metadata: expect.any(Object),
      })
    );
  });
});
