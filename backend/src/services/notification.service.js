const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const { ACCOUNT_TYPE } = require('../config/accountTypes');
const { isUsableTenantId } = require('../utils/tenantScope');
const logger = require('../utils/logger');
const emailService = require('./email.service');
const {
  resolveChannels,
  deliver,
} = require('./notificationDispatcher.service');
const { emitToUser } = require('../notifications/registry');
const { NOTIFICATION_CHANNELS } = require('../config/notificationEvents');

/** How a notification is categorised for the client. */
const NOTIFICATION_TYPE = {
  PAYROLL: 'payroll',
  EXPENSE: 'expense',
  LOAN: 'loan',
  WORKFLOW: 'workflow',
  EMPLOYEE: 'employee',
  SETTLEMENT: 'settlement',
};

/** Who should hear about an event. */
const AUDIENCE = {
  COMPANY_ADMINS: 'COMPANY_ADMINS',
};

const NOTIFIABLE_ACTIONS = {
  PAYROLL_APPROVE: {
    type: NOTIFICATION_TYPE.PAYROLL,
    title: 'Payroll approved',
    message: (p) =>
      `A payroll run was approved${countSuffix(p)}. It is ready to be finalized.`,
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/payroll',
  },
  PAYROLL_REJECT: {
    type: NOTIFICATION_TYPE.PAYROLL,
    title: 'Payroll rejected',
    message: (p) =>
      `A payroll run was sent back${countSuffix(p)} and needs another look.`,
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/payroll',
  },
  PAYROLL_FINALIZE: {
    type: NOTIFICATION_TYPE.PAYROLL,
    title: 'Payroll finalized',
    message: (p) => `A payroll run was finalized${countSuffix(p)}.`,
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/payroll',
  },
  EXPENSE_SUBMIT: {
    type: NOTIFICATION_TYPE.EXPENSE,
    title: 'Expense claim submitted',
    message: () => 'A new expense claim is waiting for approval.',
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/expenses',
  },
  LOAN_ISSUE: {
    type: NOTIFICATION_TYPE.LOAN,
    title: 'Loan issued',
    message: () =>
      'A salary advance was issued and will be recovered in payroll.',
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/loans',
  },
  LOAN_STATUS_CHANGE: {
    type: NOTIFICATION_TYPE.LOAN,
    title: 'Loan status changed',
    message: (p) =>
      p?.details?.status
        ? `A loan moved to "${p.details.status}".`
        : 'A loan changed status.',
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/loans',
  },
  WORKFLOW_INSTANCE_START: {
    type: NOTIFICATION_TYPE.WORKFLOW,
    title: 'Approval requested',
    message: (p) =>
      p?.details?.targetEntityType
        ? `A ${p.details.targetEntityType} was raised for approval.`
        : 'A new approval request was raised.',
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/approvals',
  },
  WORKFLOW_TRANSITION: {
    type: NOTIFICATION_TYPE.WORKFLOW,
    title: 'Approval step completed',
    message: (p) =>
      p?.details?.status
        ? `An approval request is now "${p.details.status}".`
        : 'An approval request moved to its next step.',
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/approvals',
  },
  SETTLEMENT_STATUS_CHANGE: {
    type: NOTIFICATION_TYPE.SETTLEMENT,
    title: 'Settlement updated',
    message: (p) =>
      p?.details?.status
        ? `A full & final settlement moved to "${p.details.status}".`
        : 'A full & final settlement was updated.',
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/settlements',
  },
  EMPLOYEE_EXIT_INITIATED: {
    type: NOTIFICATION_TYPE.EMPLOYEE,
    title: 'Employee exit started',
    message: () =>
      'An employee exit was initiated. A final settlement may be required.',
    audience: AUDIENCE.COMPANY_ADMINS,
    link: '/settlements',
  },
};

function countSuffix(payload) {
  const count = Array.isArray(payload?.resourceIds)
    ? payload.resourceIds.length
    : 0;

  if (count > 1) return ` (${count} records)`;
  return '';
}

function isNotifiable(action) {
  return Object.prototype.hasOwnProperty.call(NOTIFIABLE_ACTIONS, action);
}

async function resolveRecipients(payload, tenantId) {
  const query = {
    tenantId,
    isActive: { $ne: false },
    accountType: { $ne: ACCOUNT_TYPE.EMPLOYEE },
  };

  const recipients = await User.find(query).select('_id').lean();
  const actorId = payload?.userId ? String(payload.userId) : null;
  return recipients.filter((u) => String(u._id) !== actorId);
}

async function createNotification({
  userId,
  tenantId,
  title,
  message,
  type,
  link,
}) {
  if (!userId || !isUsableTenantId(tenantId) || !title || !message) {
    logger.warn('Notification dropped: incomplete', {
      userId: userId ? String(userId) : undefined,
      hasTenant: isUsableTenantId(tenantId),
      title,
    });
    return false;
  }

  try {
    await Notification.create({ userId, tenantId, title, message, type, link });
    return true;
  } catch (error) {
    logger.error('Failed to write a notification', {
      userId: String(userId),
      title,
      error: error.message,
    });
    return false;
  }
}

async function createNotifications(notifications) {
  const rows = (Array.isArray(notifications) ? notifications : []).filter(
    (n) => n?.userId && isUsableTenantId(n?.tenantId) && n?.title && n?.message,
  );

  if (rows.length === 0) return 0;

  try {
    const written = await Notification.insertMany(rows, { ordered: false });
    return Array.isArray(written) ? written.length : 0;
  } catch (error) {
    logger.error('Failed to write a batch of notifications', {
      attempted: rows.length,
      error: error.message,
    });
    return 0;
  }
}

async function notifyFromAuditEvent(payload) {
  try {
    const template = NOTIFIABLE_ACTIONS[payload?.action];
    if (!template) return 0;

    const tenantId = isUsableTenantId(payload?.tenantId)
      ? payload.tenantId
      : payload?.req?.tenantId;

    if (!isUsableTenantId(tenantId)) {
      logger.warn('Notification skipped: no tenant on the event', {
        action: payload?.action,
      });
      return 0;
    }

    const recipients = await resolveRecipients(payload, tenantId);
    if (recipients.length === 0) return 0;

    const message = template.message(payload);
    const channelsByUser = await resolveChannels(
      recipients.map((user) => user._id),
      payload.action,
    );

    const inAppRows = [];
    const externalDeliveries = [];

    for (const user of recipients) {
      const channels = channelsByUser.get(String(user._id)) || [];

      for (const channel of channels) {
        if (channel === NOTIFICATION_CHANNELS.IN_APP) {
          inAppRows.push({
            userId: user._id,
            tenantId,
            title: template.title,
            message,
            type: template.type,
            link: template.link,
          });
          continue;
        }

        externalDeliveries.push(
          deliver(channel, {
            to: user._id,
            subject: template.title,
            body: message,
            metadata: {
              tenantId,
              type: template.type,
              link: template.link,
              action: payload.action,
            },
          }),
        );
      }
    }

    const [written] = await Promise.all([
      createNotifications(inAppRows),
      Promise.all(externalDeliveries),
    ]);

    for (const row of inAppRows) {
      emitToUser(row.userId, 'notification:new', {
        title: row.title,
        message: row.message,
        type: row.type,
        link: row.link,
      });
    }

    return written;
  } catch (error) {
    logger.error('Failed to turn an audit event into notifications', {
      action: payload?.action,
      error: error.message,
    });
    return 0;
  }
}

class NotificationService {
  static renderTemplate(template = '', data = {}) {
    if (typeof template !== 'string') return '';
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return data[key] !== undefined ? String(data[key]) : '';
    });
  }

  static async sendNotification(userId, payload = {}) {
    const {
      title = 'Notification',
      message = '',
      category = 'SYSTEM',
      channel = 'IN_APP',
      data = {},
      emailRecipient,
    } = payload;

    const renderedTitle = this.renderTemplate(title, data);
    const renderedMessage = this.renderTemplate(message, data);

    logger.info('Dispatching notification', { userId, category, channel });
    let notificationRecord = null;

    if (channel === 'IN_APP' || channel === 'ALL') {
      try {
        notificationRecord = await Notification.create({
          userId,
          title: renderedTitle,
          message: renderedMessage,
          category,
          isRead: false,
          data,
        });
      } catch (err) {
        logger.warn('Failed to save in-app notification', { userId, error: err.message });
      }
    }

    if ((channel === 'EMAIL' || channel === 'ALL') && emailRecipient) {
      try {
        await emailService.sendEmail({
          to: emailRecipient,
          subject: renderedTitle,
          text: renderedMessage,
        });
      } catch (err) {
        logger.warn('Failed to send notification email', { emailRecipient, error: err.message });
      }
    }

    return {
      success: true,
      userId,
      channel,
      title: renderedTitle,
      message: renderedMessage,
      notificationId: notificationRecord?._id || null,
    };
  }
}

module.exports = NotificationService;
module.exports.NOTIFICATION_TYPE = NOTIFICATION_TYPE;
module.exports.AUDIENCE = AUDIENCE;
module.exports.NOTIFIABLE_ACTIONS = NOTIFIABLE_ACTIONS;
module.exports.isNotifiable = isNotifiable;
module.exports.resolveRecipients = resolveRecipients;
module.exports.createNotification = createNotification;
module.exports.createNotifications = createNotifications;
module.exports.notifyFromAuditEvent = notifyFromAuditEvent;
