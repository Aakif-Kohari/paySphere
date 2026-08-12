/**
 * Notification delivery and preferences (#440, repaired in #952).
 *
 * The first test is the load, and it is the whole regression: this module
 * required `./logger`, which does not exist, so it threw MODULE_NOT_FOUND — and
 * nothing required it, so nobody found out. Every preference row ever written
 * would have been ignored and the email and Slack providers were unreachable.
 */

jest.mock('../../models/notificationPreference.model', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../../services/cache.service', () => ({
  get: jest.fn(),
  setEx: jest.fn(),
}));
jest.mock('../../notifications/registry', () => ({
  get: jest.fn(),
}));

const NotificationPreference = require('../../models/notificationPreference.model');
const cacheService = require('../cache.service');
const registry = require('../../notifications/registry');
const dispatcher = require('../notificationDispatcher.service');

const {
  dispatch,
  deliver,
  resolveChannels,
  channelsFrom,
  DEDUP_TTL_SECONDS,
  _internals,
} = dispatcher;

const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '507f1f77bcf86cd799439012';
const TENANT = '507f1f77bcf86cd799439099';

const leanMock = (rows) => ({ lean: jest.fn().mockResolvedValue(rows) });

/** A provider that records what it was asked to send. */
const provider = () => ({ send: jest.fn().mockResolvedValue(undefined) });

let providers;

beforeEach(() => {
  jest.clearAllMocks();

  providers = {
    in_app: provider(),
    email: provider(),
    slack: provider(),
  };

  registry.get.mockImplementation((channel) => {
    const p = providers[channel];
    if (!p)
      throw new Error(`No notification provider for channel "${channel}"`);
    return p;
  });

  NotificationPreference.find.mockReturnValue(leanMock([]));
  NotificationPreference.findOne.mockReturnValue(leanMock(null));
  cacheService.get.mockResolvedValue(null);
  cacheService.setEx.mockResolvedValue(undefined);
});

describe('the module loads (#952)', () => {
  it('resolves every module it requires', () => {
    expect(() => require('../notificationDispatcher.service')).not.toThrow();
    expect(typeof dispatch).toBe('function');
  });
});

describe('reading a preference', () => {
  it('defaults to the bell alone when none is stored', () => {
    expect(channelsFrom(null)).toEqual(['in_app']);
  });

  it('returns nothing when the user has switched the event off', () => {
    expect(channelsFrom({ enabled: false, channels: ['email'] })).toEqual([]);
  });

  it('returns the channels the user chose', () => {
    expect(
      channelsFrom({ enabled: true, channels: ['email', 'slack'] }),
    ).toEqual(['email', 'slack']);
  });

  it('drops a channel with no provider', () => {
    expect(
      channelsFrom({ enabled: true, channels: ['email', 'carrier-pigeon'] }),
    ).toEqual(['email']);
  });

  it('falls back to the default when a row enables an event but names no usable channel', () => {
    // "Tell me about this" with no instruction about where is not the same as
    // "do not tell me", and silence would be a preference nobody expressed.
    expect(channelsFrom({ enabled: true, channels: [] })).toEqual(['in_app']);
  });
});

describe('resolving a whole set of recipients', () => {
  it('asks once for everybody', async () => {
    await resolveChannels([USER_A, USER_B], 'PAYROLL_APPROVE');

    expect(NotificationPreference.find).toHaveBeenCalledTimes(1);
    expect(NotificationPreference.find).toHaveBeenCalledWith({
      userId: { $in: [USER_A, USER_B] },
      eventType: 'PAYROLL_APPROVE',
    });
  });

  it('gives the stored answer to those who have one and the default to the rest', async () => {
    NotificationPreference.find.mockReturnValue(
      leanMock([{ userId: USER_A, enabled: true, channels: ['email'] }]),
    );

    const resolved = await resolveChannels([USER_A, USER_B], 'PAYROLL_APPROVE');

    expect(resolved.get(USER_A)).toEqual(['email']);
    expect(resolved.get(USER_B)).toEqual(['in_app']);
  });

  it('falls back to the default for everybody when the lookup fails', async () => {
    // Losing the notification entirely is worse than ignoring a preference
    // once, so a database problem here does not silence anyone.
    NotificationPreference.find.mockImplementation(() => {
      throw new Error('collection unavailable');
    });

    const resolved = await resolveChannels([USER_A], 'PAYROLL_APPROVE');

    expect(resolved.get(USER_A)).toEqual(['in_app']);
  });
});

describe('delivering', () => {
  it('hands the message to the provider for the channel', async () => {
    const ok = await deliver('email', {
      to: USER_A,
      subject: 'Payroll approved',
      body: 'A payroll run was approved.',
      metadata: { tenantId: TENANT },
    });

    expect(ok).toBe(true);
    expect(providers.email.send).toHaveBeenCalledWith({
      to: USER_A,
      subject: 'Payroll approved',
      body: 'A payroll run was approved.',
      metadata: { tenantId: TENANT },
    });
  });

  it('reports a provider failure without throwing', async () => {
    providers.email.send.mockRejectedValue(new Error('SMTP down'));

    await expect(
      deliver('email', { to: USER_A, subject: 's', body: 'b' }),
    ).resolves.toBe(false);
  });

  it('treats an unregistered channel as a failed delivery, not a crash', async () => {
    await expect(
      deliver('carrier-pigeon', { to: USER_A, subject: 's', body: 'b' }),
    ).resolves.toBe(false);
  });
});

describe('dispatching to one person', () => {
  const notification = (overrides = {}) => ({
    userId: USER_A,
    tenantId: TENANT,
    eventType: 'EXPENSE_SUBMIT',
    subject: 'Expense claim submitted',
    body: 'A new expense claim is waiting for approval.',
    subjectId: 'claim-1',
    ...overrides,
  });

  it('sends on every channel the preference names', async () => {
    NotificationPreference.findOne.mockReturnValue(
      leanMock({ enabled: true, channels: ['in_app', 'email'] }),
    );

    const result = await dispatch(notification());

    expect(result.sent).toEqual(['in_app', 'email']);
    expect(providers.in_app.send).toHaveBeenCalledTimes(1);
    expect(providers.email.send).toHaveBeenCalledTimes(1);
    expect(providers.slack.send).not.toHaveBeenCalled();
  });

  it('sends nothing when the user has switched the event off', async () => {
    NotificationPreference.findOne.mockReturnValue(
      leanMock({ enabled: false, channels: ['in_app'] }),
    );

    const result = await dispatch(notification());

    expect(result).toEqual({ sent: [], suppressed: 'preference' });
    expect(providers.in_app.send).not.toHaveBeenCalled();
  });

  it('keeps delivering on the other channels when one provider fails', async () => {
    NotificationPreference.findOne.mockReturnValue(
      leanMock({ enabled: true, channels: ['in_app', 'email'] }),
    );
    providers.email.send.mockRejectedValue(new Error('SMTP down'));

    const result = await dispatch(notification());

    expect(result.sent).toEqual(['in_app']);
    expect(providers.in_app.send).toHaveBeenCalled();
  });

  it('suppresses a true repeat', async () => {
    cacheService.get.mockResolvedValue(true);

    const result = await dispatch(notification());

    expect(result).toEqual({ sent: [], suppressed: 'duplicate' });
    expect(providers.in_app.send).not.toHaveBeenCalled();
  });

  it('does not suppress a different subject', async () => {
    // The regression this key change exists for: keyed on user and event type
    // alone, two expense claims approved for the same person inside five
    // minutes produced one notification and the second was never mentioned.
    const { dedupKey } = _internals;

    expect(dedupKey(USER_A, 'EXPENSE_SUBMIT', 'claim-1')).not.toBe(
      dedupKey(USER_A, 'EXPENSE_SUBMIT', 'claim-2'),
    );
  });

  it('records the send with the cache API that exists', async () => {
    await dispatch(notification());

    // setEx(key, ttl, value). The call this replaced was `set(key, value, ttl)`,
    // which is neither the right name nor the right argument order, so the
    // guard could never have written a key.
    expect(cacheService.setEx).toHaveBeenCalledWith(
      expect.stringContaining('notif:dedup:'),
      DEDUP_TTL_SECONDS,
      true,
    );
  });

  it('does not record a send when nothing went out', async () => {
    providers.in_app.send.mockRejectedValue(new Error('write failed'));

    const result = await dispatch(notification());

    expect(result.sent).toEqual([]);
    // Otherwise a total delivery failure is suppressed for five minutes rather
    // than retried on the next event.
    expect(cacheService.setEx).not.toHaveBeenCalled();
  });

  it('sends anyway when the dedup cache is unreachable', async () => {
    cacheService.get.mockRejectedValue(new Error('redis down'));

    const result = await dispatch(notification());

    expect(result.sent).toEqual(['in_app']);
  });

  it('drops an incomplete notification instead of sending a blank one', async () => {
    const result = await dispatch(notification({ subject: '' }));

    expect(result).toEqual({ sent: [], suppressed: 'incomplete' });
    expect(providers.in_app.send).not.toHaveBeenCalled();
  });
});
