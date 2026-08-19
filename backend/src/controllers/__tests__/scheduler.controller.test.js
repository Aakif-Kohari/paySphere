jest.mock('../../models/reportSchedule.model', () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const ReportSchedule = jest.fn(function (doc) {
    Object.assign(this, doc);
    this._id = 'schedule-1';
    this.save = save;
  });
  ReportSchedule.find = jest.fn();
  ReportSchedule.findOneAndDelete = jest.fn();
  ReportSchedule.__save = save;
  ReportSchedule.REPORT_TYPES = ['analytics', 'payroll', 'turnover', 'custom'];
  ReportSchedule.FREQUENCIES = ['daily', 'weekly', 'monthly'];
  ReportSchedule.MAX_RECIPIENTS = 25;
  return ReportSchedule;
});
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mongoose = require('mongoose');
const ReportSchedule = require('../../models/reportSchedule.model');
const {
  createSchedule,
  getSchedules,
  deleteSchedule,
  normalizeRecipients,
  validateConfig,
  MAX_COLUMNS,
} = require('../scheduler.controller');

const TENANT_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();
const SCHEDULE_ID = new mongoose.Types.ObjectId().toString();

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildReq = (body = {}, overrides = {}) => ({
  userId: USER_ID,
  tenantId: TENANT_ID,
  params: {},
  body: {
    reportType: 'payroll',
    frequency: 'monthly',
    recipients: ['hr@acme.com'],
    ...body,
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  ReportSchedule.__save.mockResolvedValue(undefined);
});

describe('normalizeRecipients (#666)', () => {
  test('accepts a real address', () => {
    expect(normalizeRecipients(['hr@acme.com'])).toEqual({
      ok: true,
      recipients: ['hr@acme.com'],
    });
  });

  test('trims, lower-cases and de-duplicates', () => {
    // Stored verbatim before, so the same person got a copy per spelling.
    expect(
      normalizeRecipients(['HR@acme.com', ' hr@acme.com ', 'hr@acme.com'])
        .recipients,
    ).toEqual(['hr@acme.com']);
  });

  test('names the invalid address', () => {
    const result = normalizeRecipients(['hr@acme.com', 'nope']);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('nope');
  });

  test('rejects a non-array or an empty one', () => {
    for (const value of [undefined, null, [], 'hr@acme.com', {}]) {
      expect(normalizeRecipients(value).ok).toBe(false);
    }
  });

  test('rejects a non-string element', () => {
    expect(normalizeRecipients([{ $ne: null }]).ok).toBe(false);
  });

  test('caps the list', () => {
    const many = Array.from({ length: 26 }, (_, i) => `p${i}@acme.com`);

    expect(normalizeRecipients(many).ok).toBe(false);
  });
});

describe('validateConfig (#666)', () => {
  test('an absent config is fine', () => {
    expect(validateConfig(undefined)).toEqual({ ok: true, config: undefined });
    expect(validateConfig(null)).toEqual({ ok: true, config: undefined });
  });

  test('rejects a non-object', () => {
    expect(validateConfig('employees').ok).toBe(false);
    expect(validateConfig([]).ok).toBe(false);
  });

  test('rejects an unknown dataset', () => {
    expect(validateConfig({ dataset: 'salaries' }).ok).toBe(false);
    expect(validateConfig({ dataset: 'payroll' }).ok).toBe(true);
  });

  test('rejects malformed columns', () => {
    expect(validateConfig({ columns: 'name' }).ok).toBe(false);
    expect(validateConfig({ columns: [''] }).ok).toBe(false);
    expect(validateConfig({ columns: [{}] }).ok).toBe(false);
  });

  test('caps the column count', () => {
    const many = Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `c${i}`);

    expect(validateConfig({ columns: many }).ok).toBe(false);
  });

  test('rejects non-array filters', () => {
    expect(validateConfig({ filters: { field: 'x' } }).ok).toBe(false);
  });
});

describe('createSchedule (#666)', () => {
  test('a valid payload is created — this used to be impossible', async () => {
    const res = buildRes();

    await createSchedule(buildReq(), res, jest.fn());

    expect(ReportSchedule.__save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('writes both createdBy and tenantId', async () => {
    await createSchedule(buildReq(), buildRes(), jest.fn());

    const [doc] = ReportSchedule.mock.calls[0];
    expect(doc.createdBy).toBe(USER_ID);
    expect(doc.tenantId).toBe(TENANT_ID);
  });

  test('stores the normalised recipients', async () => {
    await createSchedule(
      buildReq({ recipients: ['HR@acme.com', 'hr@acme.com '] }),
      buildRes(),
      jest.fn(),
    );

    expect(ReportSchedule.mock.calls[0][0].recipients).toEqual(['hr@acme.com']);
  });

  test('an invalid address is a 400 naming it, not a 500', async () => {
    const res = buildRes();

    await createSchedule(
      buildReq({ recipients: ['not-an-email'] }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.stringContaining('not-an-email'),
    });
    expect(ReportSchedule.__save).not.toHaveBeenCalled();
  });

  test('an unknown reportType is a 400 listing the allowed values', async () => {
    const res = buildRes();

    await createSchedule(buildReq({ reportType: 'quarterly' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.stringContaining('analytics, payroll, turnover, custom'),
    });
  });

  test('an unknown frequency is a 400 listing the allowed values', async () => {
    const res = buildRes();

    await createSchedule(buildReq({ frequency: 'hourly' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.stringContaining('daily, weekly, monthly'),
    });
  });

  test('a malformed config is a 400', async () => {
    const res = buildRes();

    await createSchedule(
      buildReq({ config: { dataset: 'everything' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ReportSchedule.__save).not.toHaveBeenCalled();
  });

  test('a missing body is a 400, not a TypeError', async () => {
    const res = buildRes();
    const next = jest.fn();

    await createSchedule(
      { userId: USER_ID, tenantId: TENANT_ID, params: {}, body: undefined },
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('a request with no tenant is refused', async () => {
    const next = jest.fn();

    await createSchedule(
      buildReq({}, { tenantId: undefined }),
      buildRes(),
      next,
    );

    expect(ReportSchedule.__save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MissingTenantError' }),
    );
  });
});

describe('getSchedules (#666)', () => {
  test('lists the tenant\'s schedules', async () => {
    ReportSchedule.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });

    const res = buildRes();
    await getSchedules(buildReq(), res, jest.fn());

    expect(ReportSchedule.find).toHaveBeenCalledWith({ tenantId: TENANT_ID });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('refuses an unscoped request', async () => {
    const next = jest.fn();

    await getSchedules(buildReq({}, { tenantId: undefined }), buildRes(), next);

    expect(ReportSchedule.find).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MissingTenantError' }),
    );
  });
});

describe('deleteSchedule (#666)', () => {
  test('deletes within the tenant', async () => {
    ReportSchedule.findOneAndDelete.mockResolvedValue({ _id: SCHEDULE_ID });

    const res = buildRes();
    await deleteSchedule(
      buildReq({}, { params: { id: SCHEDULE_ID } }),
      res,
      jest.fn(),
    );

    expect(ReportSchedule.findOneAndDelete).toHaveBeenCalledWith({
      _id: SCHEDULE_ID,
      tenantId: TENANT_ID,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('another tenant\'s id is a 404, not a leak', async () => {
    ReportSchedule.findOneAndDelete.mockResolvedValue(null);

    const res = buildRes();
    await deleteSchedule(
      buildReq({}, { params: { id: SCHEDULE_ID } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('a malformed id is a 400, not a CastError 500', async () => {
    const res = buildRes();

    await deleteSchedule(
      buildReq({}, { params: { id: 'not-an-id' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ReportSchedule.findOneAndDelete).not.toHaveBeenCalled();
  });
});
