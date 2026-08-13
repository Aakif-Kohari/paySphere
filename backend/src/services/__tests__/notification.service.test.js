const mongoose = require('mongoose');
const User = require('../../models/user.model');
const Notification = require('../../models/notification.model');
const {
  NOTIFIABLE_ACTIONS,
  isNotifiable,
  resolveRecipients,
  createNotification,
  createNotifications,
  notifyFromAuditEvent,
} = require('../notification.service');
const { ACCOUNT_TYPE } = require('../../config/accountTypes');

jest.mock('../../models/user.model');
jest.mock('../../models/notification.model');
// Preferences are consulted for every recipient since #952. Mocked at the
// model rather than at the dispatcher, so this suite still exercises the real
// preference resolution; unmocked it buffers against a database the suite
// never connects to and every test here times out.
jest.mock('../../models/notificationPreference.model', () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
  findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
}));
jest.mock('../../notifications/registry', () => ({
  get: jest.fn(),
  emitToUser: jest.fn(),
  setIO: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const oid = () => new mongoose.Types.ObjectId().toString();

const TENANT = oid();
const ACTOR = oid();
const ADMIN_A = oid();
const ADMIN_B = oid();

/** `User.find(...).select(...).lean()` resolving to `rows`. */
const usersAre = (rows) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
  User.find.mockReturnValue(chain);

  return chain;
};

const auditEvent = (overrides = {}) => ({
  userId: ACTOR,
  action: 'PAYROLL_APPROVE',
  resourceType: 'PayrollUpdate',
  resourceIds: [oid()],
  req: { tenantId: TENANT },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  usersAre([{ _id: ADMIN_A }, { _id: ADMIN_B }, { _id: ACTOR }]);
  Notification.insertMany.mockResolvedValue([{}, {}]);
  Notification.create.mockResolvedValue({});
});

/**
 * `notification.service.js` (#898).
 *
 * The bug is an absence, so the tests are about a write path existing at all:
 * there was a model, a controller, a router and a bell, and
 * `grep -rn "Notification.create\|new Notification("` over `backend/src`
 * returned nothing. Every account's notification centre was empty forever.
 */

describe('which events are notifiable', () => {
  test('an approval-shaped event is', () => {
    expect(isNotifiable('PAYROLL_APPROVE')).toBe(true);
    expect(isNotifiable('EXPENSE_SUBMIT')).toBe(true);
    expect(isNotifiable('WORKFLOW_INSTANCE_START')).toBe(true);
  });

  test('routine record-keeping is not', () => {
    // An audit log is exhaustive because its job is answering questions later.
    // A notification centre that is exhaustive is one nobody reads.
    expect(isNotifiable('EMPLOYEE_UPDATE')).toBe(false);
    expect(isNotifiable('REPORT_DOWNLOAD')).toBe(false);
    expect(isNotifiable('SETTINGS_UPDATE')).toBe(false);
  });

  test('an unknown action is not, and does not throw', () => {
    expect(isNotifiable('NOT_A_THING')).toBe(false);
    expect(isNotifiable(undefined)).toBe(false);
  });

  test('every template is complete', () => {
    // The property that has to hold as actions are added: a template missing a
    // message function throws inside a detached listener.
    for (const [action, template] of Object.entries(NOTIFIABLE_ACTIONS)) {
      expect(typeof template.title).toBe('string');
      expect(template.title.length).toBeGreaterThan(0);
      expect(typeof template.message).toBe('function');
      expect(typeof template.message({ action })).toBe('string');
      expect(typeof template.type).toBe('string');
    }
  });
});

describe('who is told (#898)', () => {
  test('the company admins are', async () => {
    const recipients = await resolveRecipients(auditEvent(), TENANT);

    expect(recipients.map((r) => String(r._id)).sort()).toEqual(
      [ADMIN_A, ADMIN_B].sort(),
    );
  });

  test('the person who did it is not', async () => {
    // Telling someone what they have just done themselves is the fastest way to
    // train a person to ignore a bell.
    const recipients = await resolveRecipients(auditEvent(), TENANT);

    expect(recipients.map((r) => String(r._id))).not.toContain(ACTOR);
  });

  test('the query is scoped to the tenant', async () => {
    await resolveRecipients(auditEvent(), TENANT);

    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT }),
    );
  });

  test('portal-only accounts are excluded', async () => {
    // Everything on the notifiable list is an admin-console concern, and a
    // self-service login has no page to be sent to.
    await resolveRecipients(auditEvent(), TENANT);

    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: { $ne: ACCOUNT_TYPE.EMPLOYEE },
      }),
    );
  });

  test('deactivated accounts are excluded', async () => {
    await resolveRecipients(auditEvent(), TENANT);

    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: { $ne: false } }),
    );
  });
});

describe('notifyFromAuditEvent (#898)', () => {
  test('writes one notification per recipient', async () => {
    const written = await notifyFromAuditEvent(auditEvent());

    expect(Notification.insertMany).toHaveBeenCalled();
    const [rows] = Notification.insertMany.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(written).toBe(2);
  });

  test('each row carries the tenant, a type and a link', async () => {
    await notifyFromAuditEvent(auditEvent());

    const [rows] = Notification.insertMany.mock.calls[0];
    for (const row of rows) {
      expect(String(row.tenantId)).toBe(TENANT);
      expect(row.title).toBe('Payroll approved');
      expect(typeof row.message).toBe('string');
      expect(row.type).toBe('payroll');
      expect(row.link).toBe('/payroll');
    }
  });

  test('the batch is unordered, so one bad row does not discard the rest', async () => {
    await notifyFromAuditEvent(auditEvent());

    expect(Notification.insertMany).toHaveBeenCalledWith(expect.any(Array), {
      ordered: false,
    });
  });

  test('an event nobody is told about writes nothing', async () => {
    const written = await notifyFromAuditEvent(
      auditEvent({ action: 'REPORT_DOWNLOAD' }),
    );

    expect(written).toBe(0);
    expect(Notification.insertMany).not.toHaveBeenCalled();
    expect(User.find).not.toHaveBeenCalled();
  });

  test('the tenant is taken from the request when not explicit', async () => {
    // Every emit site already passes `req`, which auth.middleware has stamped —
    // the same resolution audit.service.js uses, so the two agree about which
    // company an event belongs to.
    await notifyFromAuditEvent(auditEvent({ tenantId: undefined }));

    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT }),
    );
  });

  test('an explicit tenant wins over the request', async () => {
    const explicit = oid();
    await notifyFromAuditEvent(auditEvent({ tenantId: explicit }));

    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: explicit }),
    );
  });

  test('an event with no tenant writes nothing rather than broadcasting', async () => {
    const written = await notifyFromAuditEvent(
      auditEvent({ tenantId: undefined, req: {} }),
    );

    expect(written).toBe(0);
    expect(User.find).not.toHaveBeenCalled();
  });

  test('a company with only the actor in it writes nothing', async () => {
    usersAre([{ _id: ACTOR }]);

    expect(await notifyFromAuditEvent(auditEvent())).toBe(0);
    expect(Notification.insertMany).not.toHaveBeenCalled();
  });

  test('a multi-record event says how many', async () => {
    await notifyFromAuditEvent(
      auditEvent({ resourceIds: [oid(), oid(), oid()] }),
    );

    const [rows] = Notification.insertMany.mock.calls[0];
    expect(rows[0].message).toMatch(/\(3 records\)/);
  });

  test('a single-record event does not', async () => {
    await notifyFromAuditEvent(auditEvent({ resourceIds: [oid()] }));

    const [rows] = Notification.insertMany.mock.calls[0];
    expect(rows[0].message).not.toMatch(/records\)/);
  });

  test('details are used when a template asks for them', async () => {
    await notifyFromAuditEvent(
      auditEvent({
        action: 'WORKFLOW_TRANSITION',
        details: { status: 'completed' },
      }),
    );

    const [rows] = Notification.insertMany.mock.calls[0];
    expect(rows[0].message).toMatch(/"completed"/);
  });

  test('a template falls back when the details are absent', async () => {
    await notifyFromAuditEvent(
      auditEvent({ action: 'WORKFLOW_TRANSITION', details: undefined }),
    );

    const [rows] = Notification.insertMany.mock.calls[0];
    expect(typeof rows[0].message).toBe('string');
    expect(rows[0].message.length).toBeGreaterThan(0);
  });
});

describe('nothing here may throw (#898)', () => {
  // This runs detached from a request whose mutation has already committed, and
  // `EventEmitter.emit` is synchronous — so an exception escaping is either an
  // unhandled rejection or a 500 for an operation that succeeded. The same
  // contract `emitAuditLog` has.

  test('a recipient lookup failure is swallowed', async () => {
    User.find.mockImplementation(() => {
      throw new Error('connection reset');
    });

    await expect(notifyFromAuditEvent(auditEvent())).resolves.toBe(0);
  });

  test('an insert failure is swallowed', async () => {
    Notification.insertMany.mockRejectedValue(new Error('write concern'));

    await expect(notifyFromAuditEvent(auditEvent())).resolves.toBe(0);
  });

  test('a malformed payload is swallowed', async () => {
    await expect(notifyFromAuditEvent(null)).resolves.toBe(0);
    await expect(notifyFromAuditEvent(undefined)).resolves.toBe(0);
    await expect(notifyFromAuditEvent({})).resolves.toBe(0);
  });

  test('a template that throws is swallowed', async () => {
    const original = NOTIFIABLE_ACTIONS.PAYROLL_APPROVE.message;
    NOTIFIABLE_ACTIONS.PAYROLL_APPROVE.message = () => {
      throw new Error('bad template');
    };

    await expect(notifyFromAuditEvent(auditEvent())).resolves.toBe(0);

    NOTIFIABLE_ACTIONS.PAYROLL_APPROVE.message = original;
  });
});

describe('createNotification', () => {
  test('writes one row', async () => {
    const written = await createNotification({
      userId: ADMIN_A,
      tenantId: TENANT,
      title: 'Hello',
      message: 'World',
    });

    expect(written).toBe(true);
    expect(Notification.create).toHaveBeenCalled();
  });

  test('refuses a row with no tenant', async () => {
    const written = await createNotification({
      userId: ADMIN_A,
      title: 'Hello',
      message: 'World',
    });

    expect(written).toBe(false);
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('refuses a row with no recipient', async () => {
    expect(
      await createNotification({
        tenantId: TENANT,
        title: 'Hello',
        message: 'World',
      }),
    ).toBe(false);
  });

  test('a write failure returns false rather than throwing', async () => {
    Notification.create.mockRejectedValue(new Error('nope'));

    await expect(
      createNotification({
        userId: ADMIN_A,
        tenantId: TENANT,
        title: 'Hello',
        message: 'World',
      }),
    ).resolves.toBe(false);
  });
});

describe('createNotifications', () => {
  test('drops incomplete rows and writes the rest', async () => {
    Notification.insertMany.mockResolvedValue([{}]);

    const written = await createNotifications([
      { userId: ADMIN_A, tenantId: TENANT, title: 'a', message: 'b' },
      { userId: ADMIN_B, title: 'no tenant', message: 'b' },
    ]);

    const [rows] = Notification.insertMany.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(written).toBe(1);
  });

  test('an empty batch is a no-op', async () => {
    expect(await createNotifications([])).toBe(0);
    expect(await createNotifications(null)).toBe(0);
    expect(Notification.insertMany).not.toHaveBeenCalled();
  });
});

describe('preferences decide who hears about it, and where (#952)', () => {
  const NotificationPreference = require('../../models/notificationPreference.model');
  const registry = require('../../notifications/registry');
  const {
    NOTIFICATION_EVENT_TYPES,
  } = require('../../config/notificationEvents');

  /** `NotificationPreference.find(...).lean()` resolving to `rows`. */
  const preferencesAre = (rows) => {
    NotificationPreference.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(rows),
    });
  };

  test('the preference vocabulary is exactly what the service can notify about', () => {
    // #440's preference model enumerated seven event names, none of which
    // anything in the codebase emits, so no preference it accepted could ever
    // have matched a notification. This is the check that keeps the two lists
    // from drifting apart again.
    expect([...NOTIFICATION_EVENT_TYPES].sort()).toEqual(
      Object.keys(NOTIFIABLE_ACTIONS).sort(),
    );
  });

  test('a recipient who switched the event off gets no row', async () => {
    preferencesAre([
      { userId: ADMIN_A, eventType: 'PAYROLL_APPROVE', enabled: false },
    ]);

    const written = await notifyFromAuditEvent(auditEvent());

    const [rows] = Notification.insertMany.mock.calls[0];

    expect(rows).toHaveLength(1);
    expect(String(rows[0].userId)).toBe(ADMIN_B);
    expect(written).toBe(2); // what the mocked insertMany reports
  });

  test('a recipient on email gets a delivery and no bell row', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    registry.get.mockReturnValue({ send });

    preferencesAre([
      {
        userId: ADMIN_A,
        eventType: 'PAYROLL_APPROVE',
        enabled: true,
        channels: ['email'],
      },
    ]);

    await notifyFromAuditEvent(auditEvent());

    const [rows] = Notification.insertMany.mock.calls[0];

    expect(rows.map((r) => String(r.userId))).toEqual([ADMIN_B]);
    expect(registry.get).toHaveBeenCalledWith('email');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Payroll approved' }),
    );
  });

  test('a provider that throws does not stop the bell rows being written', async () => {
    registry.get.mockReturnValue({
      send: jest.fn().mockRejectedValue(new Error('SMTP down')),
    });

    preferencesAre([
      {
        userId: ADMIN_A,
        eventType: 'PAYROLL_APPROVE',
        enabled: true,
        channels: ['email', 'in_app'],
      },
    ]);

    await expect(notifyFromAuditEvent(auditEvent())).resolves.toBe(2);
    expect(Notification.insertMany).toHaveBeenCalled();
  });

  test('everyone due a bell row also gets a live push', async () => {
    // `registry.setIO` was never called before #952, so `emitToUser` had no
    // socket server and the client only found out at its next poll.
    await notifyFromAuditEvent(auditEvent());

    expect(registry.emitToUser).toHaveBeenCalledTimes(2);
    expect(registry.emitToUser).toHaveBeenCalledWith(
      expect.anything(),
      'notification:new',
      expect.objectContaining({ title: 'Payroll approved' }),
    );
  });
});
