'use strict';

const mongoose = require('mongoose');
const User = require('../../models/user.model');
const Notification = require('../../models/notification.model');
const NotificationService = require('../notification.service');
const {
  NOTIFIABLE_ACTIONS,
  isNotifiable,
  resolveRecipients,
  createNotification,
  createNotifications,
  notifyFromAuditEvent,
} = NotificationService;
const { ACCOUNT_TYPE } = require('../../config/accountTypes');

jest.mock('../../models/user.model');
jest.mock('../../models/notification.model');
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

describe('which events are notifiable', () => {
  test('an approval-shaped event is', () => {
    expect(isNotifiable('PAYROLL_APPROVE')).toBe(true);
    expect(isNotifiable('EXPENSE_SUBMIT')).toBe(true);
    expect(isNotifiable('WORKFLOW_INSTANCE_START')).toBe(true);
  });

  test('routine record-keeping is not', () => {
    expect(isNotifiable('EMPLOYEE_UPDATE')).toBe(false);
    expect(isNotifiable('REPORT_DOWNLOAD')).toBe(false);
    expect(isNotifiable('SETTINGS_UPDATE')).toBe(false);
  });

  test('an unknown action is not, and does not throw', () => {
    expect(isNotifiable('NOT_A_THING')).toBe(false);
    expect(isNotifiable(undefined)).toBe(false);
  });

  test('every template is complete', () => {
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
    const recipients = await resolveRecipients(auditEvent(), TENANT);
    expect(recipients.map((r) => String(r._id))).not.toContain(ACTOR);
  });

  test('the query is scoped to the tenant', async () => {
    await resolveRecipients(auditEvent(), TENANT);
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT }),
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
});

describe('NotificationService Engine', () => {
  describe('renderTemplate', () => {
    it('should replace {{variable}} placeholders with context data', () => {
      const template = 'Hello {{name}}, your payroll for {{month}} is ready.';
      const rendered = NotificationService.renderTemplate(template, { name: 'John', month: 'August' });

      expect(rendered).toBe('Hello John, your payroll for August is ready.');
    });

    it('should return empty string for non-string templates', () => {
      expect(NotificationService.renderTemplate(null)).toBe('');
    });
  });

  describe('sendNotification', () => {
    it('should process notification dispatch payload cleanly', async () => {
      const result = await NotificationService.sendNotification('user123', {
        title: 'Payroll Alert: {{id}}',
        message: 'Your payout of {{amount}} is approved.',
        data: { id: 'PR-88', amount: '$5,000' },
        channel: 'IN_APP',
      });

      expect(result.success).toBe(true);
      expect(result.title).toBe('Payroll Alert: PR-88');
      expect(result.message).toBe('Your payout of $5,000 is approved.');
    });
  });
});
