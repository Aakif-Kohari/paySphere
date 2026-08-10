const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const { ACCOUNT_TYPE } = require('../config/accountTypes');
const { isUsableTenantId } = require('../utils/tenantScope');
const logger = require('../utils/logger');

/**
 * Turning something that happened into something a person is told (#898).
 *
 * There was a `Notification` model, three controller handlers, a mounted router
 * and a bell in the navbar that polls, renders an unread badge and offers "mark
 * all as read". And nothing, anywhere, created a notification:
 *
 *     $ grep -rn "Notification.create\|new Notification(" backend/src
 *     $
 *
 * So `GET /api/notifications` answered `{ notifications: [], unreadCount: 0 }`
 * for every user forever. #440 shipped the plumbing on both sides and no source
 * of events.
 *
 * That matters more than an empty dropdown. A payroll run submitted for review,
 * an expense claim approved, a loan disbursed, an approval step landing on
 * someone — none of them told anyone. #664 made the audit log record them, but
 * an audit log is something you go and look at, not something that tells you
 * there is work waiting.
 *
 * The events already exist. `services/event.service.js` is a shared emitter and
 * `listeners/audit.listener.js` is the pattern: an exported registration
 * function called from the boot sequence, deliberately not a side-effect
 * import. This is its counterpart, and `listeners/notification.listener.js`
 * subscribes it.
 *
 * The contract here is the one `emitAuditLog` has: never throw. This runs
 * detached from the request that triggered it, after that request's mutation
 * has committed, so an exception escaping is an unhandled rejection and a 500
 * for an operation that actually succeeded.
 */

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
  /** Every admin console in the company, except whoever did it. */
  COMPANY_ADMINS: 'COMPANY_ADMINS',
};

/**
 * The audit actions worth interrupting somebody for, and what to say.
 *
 * Deliberately a short list rather than "every audit action". An audit log is
 * exhaustive because its job is answering questions afterwards; a notification
 * centre that is exhaustive is a notification centre nobody reads. The test for
 * inclusion is whether a person has to do something, or would want to know
 * within the hour — not whether it was recorded.
 *
 * `EMPLOYEE_UPDATE`, `REPORT_DOWNLOAD`, `SETTINGS_UPDATE` and the rest are
 * absent on purpose.
 *
 * @type {Record<string, {type: string, title: string, message: (payload: object) => string, audience: string, link?: string}>}
 */
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

/** " (3 records)" when the payload names several, otherwise "". */
function countSuffix(payload) {
  const count = Array.isArray(payload?.resourceIds)
    ? payload.resourceIds.length
    : 0;

  if (count > 1) return ` (${count} records)`;

  return '';
}

/**
 * Is this an action anybody is told about?
 *
 * @param {string} action
 * @returns {boolean}
 */
function isNotifiable(action) {
  return Object.prototype.hasOwnProperty.call(NOTIFIABLE_ACTIONS, action);
}

/**
 * The accounts that should receive a notification for an event.
 *
 * Excludes the actor: telling someone what they have just done themselves is
 * the fastest way to train a person to ignore a bell.
 *
 * Excludes EMPLOYEE-type accounts: everything on the notifiable list above is
 * an admin-console concern, and a self-service portal login has no page to be
 * sent to. When there is something an employee genuinely needs to hear — their
 * own payslip, their own claim — it wants its own audience and its own
 * per-employee resolution rather than a broadcast.
 *
 * @param {object} payload the audit payload
 * @param {string|object} tenantId
 * @returns {Promise<object[]>} lean user documents
 */
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

/**
 * Write one notification.
 *
 * Never throws. See the header: this runs detached from a request that has
 * already succeeded.
 *
 * @param {object} notification
 * @param {string} notification.userId recipient
 * @param {string} notification.tenantId
 * @param {string} notification.title
 * @param {string} notification.message
 * @param {string} [notification.type]
 * @param {string} [notification.link]
 * @returns {Promise<boolean>} whether it was written
 */
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

/**
 * Write one notification per recipient, in a single round trip.
 *
 * `insertMany` with `ordered: false` so one bad document does not discard the
 * rest of the batch — a notification that cannot be written for one person is
 * not a reason to leave the other five uninformed.
 *
 * @param {object[]} notifications
 * @returns {Promise<number>} how many were written
 */
async function createNotifications(notifications) {
  const rows = (Array.isArray(notifications) ? notifications : []).filter(
    (n) => n?.userId && isUsableTenantId(n?.tenantId) && n?.title && n?.message,
  );

  if (rows.length === 0) return 0;

  try {
    const written = await Notification.insertMany(rows, { ordered: false });
    return Array.isArray(written) ? written.length : 0;
  } catch (error) {
    // With `ordered: false` some documents may have been written before the
    // error, so this is "the batch was not fully written", not "nothing was".
    logger.error('Failed to write a batch of notifications', {
      attempted: rows.length,
      error: error.message,
    });
    return 0;
  }
}

/**
 * Turn one audit event into notifications for whoever should hear about it.
 *
 * Never throws.
 *
 * @param {object} payload the AUDIT_LOG payload
 * @returns {Promise<number>} how many notifications were written
 */
async function notifyFromAuditEvent(payload) {
  try {
    const template = NOTIFIABLE_ACTIONS[payload?.action];
    if (!template) return 0;

    // Same resolution as audit.service.js: an explicit tenant wins, and every
    // emit site already passes `req`, which auth.middleware has stamped.
    const tenantId = isUsableTenantId(payload?.tenantId)
      ? payload.tenantId
      : payload?.req?.tenantId;

    if (!isUsableTenantId(tenantId)) {
      // Not an error worth shouting about — the audit layer has already logged
      // the same event being dropped for the same reason, and duplicating it
      // would double every line in an incident.
      logger.warn('Notification skipped: no tenant on the event', {
        action: payload?.action,
      });
      return 0;
    }

    const recipients = await resolveRecipients(payload, tenantId);
    if (recipients.length === 0) return 0;

    const message = template.message(payload);

    return await createNotifications(
      recipients.map((user) => ({
        userId: user._id,
        tenantId,
        title: template.title,
        message,
        type: template.type,
        link: template.link,
      })),
    );
  } catch (error) {
    logger.error('Failed to turn an audit event into notifications', {
      action: payload?.action,
      error: error.message,
    });
    return 0;
  }
}

module.exports = {
  NOTIFICATION_TYPE,
  AUDIENCE,
  NOTIFIABLE_ACTIONS,
  isNotifiable,
  resolveRecipients,
  createNotification,
  createNotifications,
  notifyFromAuditEvent,
};
