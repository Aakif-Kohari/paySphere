/**
 * The preferences endpoints (#440, reachable since #952).
 *
 * There was no way to read or write a preference at all, so every notifiable
 * event went to every eligible admin's bell and nowhere else, with no way to
 * turn any of it off.
 */

jest.mock('../../models/notificationPreference.model', () => ({
  find: jest.fn(),
  bulkWrite: jest.fn(),
  deleteOne: jest.fn(),
}));

const NotificationPreference = require('../../models/notificationPreference.model');
const {
  getPreferences,
  updatePreferences,
  resetPreference,
} = require('../notificationPreference.controller');
const { NOTIFICATION_EVENT_TYPES } = require('../../config/notificationEvents');

const USER = '507f1f77bcf86cd799439011';
const TENANT = '507f1f77bcf86cd799439099';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const leanMock = (rows) => ({ lean: jest.fn().mockResolvedValue(rows) });

let req;
let res;
let next;

beforeEach(() => {
  jest.clearAllMocks();

  req = { userId: USER, tenantId: TENANT, params: {}, query: {}, body: {} };
  res = makeRes();
  next = jest.fn();

  NotificationPreference.find.mockReturnValue(leanMock([]));
  NotificationPreference.bulkWrite.mockResolvedValue({});
  NotificationPreference.deleteOne.mockResolvedValue({ deletedCount: 1 });
});

describe('GET /preferences', () => {
  it('returns every event type, not only the ones with a stored row', async () => {
    // The screen has to render the full list, and knowing what the list is is
    // not the client's job.
    await getPreferences(req, res, next);

    const payload = res.json.mock.calls[0][0];

    expect(payload.preferences).toHaveLength(NOTIFICATION_EVENT_TYPES.length);
    expect(payload.preferences.every((p) => p.isDefault)).toBe(true);
    expect(payload.channels).toContain('in_app');
  });

  it('reads only the caller’s own rows', async () => {
    await getPreferences(req, res, next);

    expect(NotificationPreference.find).toHaveBeenCalledWith({ userId: USER });
  });

  it('reports a stored preference over the default', async () => {
    NotificationPreference.find.mockReturnValue(
      leanMock([
        {
          userId: USER,
          eventType: 'PAYROLL_APPROVE',
          enabled: false,
          channels: ['email'],
        },
      ]),
    );

    await getPreferences(req, res, next);

    const stored = res.json.mock.calls[0][0].preferences.find(
      (p) => p.eventType === 'PAYROLL_APPROVE',
    );

    expect(stored).toMatchObject({
      enabled: false,
      channels: ['email'],
      isDefault: false,
    });
  });
});

describe('PUT /preferences', () => {
  it('upserts one row per event, keyed on the caller', async () => {
    req.body = {
      preferences: [
        { eventType: 'PAYROLL_APPROVE', enabled: true, channels: ['email'] },
        { eventType: 'EXPENSE_SUBMIT', enabled: false },
      ],
    };

    await updatePreferences(req, res, next);

    const operations = NotificationPreference.bulkWrite.mock.calls[0][0];

    expect(operations).toHaveLength(2);
    expect(operations[0].updateOne.filter).toEqual({
      userId: USER,
      eventType: 'PAYROLL_APPROVE',
    });
    expect(operations[0].updateOne.upsert).toBe(true);
    expect(operations[0].updateOne.update.$set.channels).toEqual(['email']);
    expect(operations[1].updateOne.update.$set.enabled).toBe(false);
  });

  it('accepts a single preference as well as a list', async () => {
    req.body = { eventType: 'LOAN_ISSUE', enabled: false };

    await updatePreferences(req, res, next);

    expect(NotificationPreference.bulkWrite.mock.calls[0][0]).toHaveLength(1);
  });

  it('rejects an event type nothing emits, and says which', async () => {
    // #440's preference model enumerated seven event types and not one of them
    // is a name anything in the codebase emits, so a preference saved against
    // any of them could never have matched a notification.
    req.body = {
      preferences: [
        { eventType: 'PAYROLL_COMPLETED', enabled: false },
        { eventType: 'PAYROLL_APPROVE', enabled: false },
      ],
    };

    await updatePreferences(req, res, next);

    const payload = res.json.mock.calls[0][0];

    expect(payload.rejected).toEqual([
      { eventType: 'PAYROLL_COMPLETED', reason: 'Unknown event type' },
    ]);
    expect(NotificationPreference.bulkWrite.mock.calls[0][0]).toHaveLength(1);
  });

  it('rejects a channel with no provider behind it', async () => {
    req.body = {
      eventType: 'PAYROLL_APPROVE',
      channels: ['email', 'carrier-pigeon'],
    };

    await updatePreferences(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(NotificationPreference.bulkWrite).not.toHaveBeenCalled();
  });

  it('de-duplicates repeated channels', async () => {
    req.body = { eventType: 'PAYROLL_APPROVE', channels: ['email', 'EMAIL'] };

    await updatePreferences(req, res, next);

    const operations = NotificationPreference.bulkWrite.mock.calls[0][0];

    expect(operations[0].updateOne.update.$set.channels).toEqual(['email']);
  });

  it('refuses a request that is not scoped to a company', async () => {
    req.tenantId = undefined;

    await updatePreferences(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(NotificationPreference.bulkWrite).not.toHaveBeenCalled();
  });

  it('reports a concurrent write as a conflict, not a 500', async () => {
    NotificationPreference.bulkWrite.mockRejectedValue({ code: 11000 });
    req.body = { eventType: 'PAYROLL_APPROVE', enabled: true };

    await updatePreferences(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('DELETE /preferences/:eventType', () => {
  it('removes the row so the default applies again', async () => {
    req.params = { eventType: 'PAYROLL_APPROVE' };

    await resetPreference(req, res, next);

    expect(NotificationPreference.deleteOne).toHaveBeenCalledWith({
      userId: USER,
      eventType: 'PAYROLL_APPROVE',
    });
    // Reset is not the same as disabled: the caller is told what they are back
    // to, rather than being left to assume.
    expect(res.json.mock.calls[0][0].channels).toEqual(['in_app']);
  });

  it('rejects an unknown event type', async () => {
    req.params = { eventType: 'NOPE' };

    await resetPreference(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(NotificationPreference.deleteOne).not.toHaveBeenCalled();
  });
});
