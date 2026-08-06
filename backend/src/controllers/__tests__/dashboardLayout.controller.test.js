jest.mock('../../models/dashboardLayout.model', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');
const DashboardLayout = require('../../models/dashboardLayout.model');
const {
  getLayout,
  saveLayout,
  validateWidgetOrder,
  MAX_WIDGETS,
  MAX_WIDGET_ID_LENGTH,
} = require('../dashboardLayout.controller');

const TENANT_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildReq = (overrides = {}) => ({
  userId: USER_ID,
  tenantId: TENANT_ID,
  body: {},
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validateWidgetOrder (#663)', () => {
  test('accepts an array of widget ids', () => {
    expect(validateWidgetOrder(['card-1', 'card-2'])).toEqual({
      ok: true,
      order: ['card-1', 'card-2'],
    });
  });

  test('accepts an empty array — that is "reset to the default order"', () => {
    expect(validateWidgetOrder([])).toEqual({ ok: true, order: [] });
  });

  test('trims surrounding whitespace', () => {
    expect(validateWidgetOrder(['  card-1  ']).order).toEqual(['card-1']);
  });

  test('rejects a non-array', () => {
    for (const value of [undefined, null, 'card-1', 42, { order: [] }]) {
      expect(validateWidgetOrder(value).ok).toBe(false);
    }
  });

  test('rejects a non-string element', () => {
    // The old handler only checked Array.isArray, so `[{"$ne": null}]` went
    // straight into the store.
    const result = validateWidgetOrder([{ $ne: null }]);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/string/);
  });

  test('rejects an empty or whitespace-only id', () => {
    expect(validateWidgetOrder(['']).ok).toBe(false);
    expect(validateWidgetOrder(['   ']).ok).toBe(false);
  });

  test('rejects duplicates', () => {
    const result = validateWidgetOrder(['card-1', 'card-1']);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/duplicate/i);
  });

  test('caps the number of widgets', () => {
    const tooMany = Array.from({ length: MAX_WIDGETS + 1 }, (_, i) => `w-${i}`);

    expect(validateWidgetOrder(tooMany).ok).toBe(false);
  });

  test('caps the length of a single id', () => {
    const long = 'x'.repeat(MAX_WIDGET_ID_LENGTH + 1);

    expect(validateWidgetOrder([long]).ok).toBe(false);
  });
});

describe('getLayout (#663)', () => {
  test('returns the stored order for the authenticated user', async () => {
    DashboardLayout.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ order: ['card-2', 'card-1'] }),
    });

    const res = buildRes();
    await getLayout(buildReq(), res, jest.fn());

    expect(DashboardLayout.findOne).toHaveBeenCalledWith({
      userId: USER_ID,
      tenantId: TENANT_ID,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ order: ['card-2', 'card-1'] });
  });

  test('returns an empty order for a user who has never saved one', async () => {
    DashboardLayout.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = buildRes();
    await getLayout(buildReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ order: [] });
  });

  test('refuses a request with no tenant instead of reading unscoped', async () => {
    const next = jest.fn();

    await getLayout(buildReq({ tenantId: undefined }), buildRes(), next);

    expect(DashboardLayout.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MissingTenantError' }),
    );
  });
});

describe('saveLayout (#663)', () => {
  test('upserts the order for the authenticated user', async () => {
    DashboardLayout.findOneAndUpdate.mockResolvedValue({
      order: ['card-3', 'card-1'],
    });

    const res = buildRes();
    await saveLayout(
      buildReq({ body: { order: ['card-3', 'card-1'] } }),
      res,
      jest.fn(),
    );

    expect(DashboardLayout.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: USER_ID },
      { $set: { order: ['card-3', 'card-1'], tenantId: TENANT_ID } },
      expect.objectContaining({ upsert: true }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      order: ['card-3', 'card-1'],
    });
  });

  test('a missing body is a 400, not a TypeError', async () => {
    // The precise failure from #663: mounted above express.json(), `req.body`
    // was undefined and `const { order } = req.body` threw on every call.
    const res = buildRes();
    const next = jest.fn();

    await saveLayout(buildReq({ body: undefined }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(DashboardLayout.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('an invalid order is a 400 naming the problem', async () => {
    const res = buildRes();

    await saveLayout(
      buildReq({ body: { order: ['card-1', 'card-1'] } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.stringMatching(/duplicate/i),
    });
  });

  test('never keys the write off a literal "anonymous"', async () => {
    DashboardLayout.findOneAndUpdate.mockResolvedValue({ order: [] });

    await saveLayout(buildReq({ body: { order: [] } }), buildRes(), jest.fn());

    const [filter] = DashboardLayout.findOneAndUpdate.mock.calls[0];
    expect(filter.userId).toBe(USER_ID);
    expect(filter.userId).not.toBe('anonymous');
  });

  test('refuses a request with no tenant', async () => {
    const next = jest.fn();

    await saveLayout(
      buildReq({ tenantId: undefined, body: { order: [] } }),
      buildRes(),
      next,
    );

    expect(DashboardLayout.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MissingTenantError' }),
    );
  });
});
