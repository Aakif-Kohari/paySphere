/**
 * The vocabulary a notification preference is expressed in (#952).
 *
 * Kept here rather than in `services/notification.service.js` because both the
 * service and `models/notificationPreference.model.js` need it, and a model
 * requiring a service would be a cycle.
 *
 * This list has to be exactly the set of events the product actually notifies
 * anybody about. #440's preference model enumerated seven event types —
 * `PAYROLL_COMPLETED`, `SALARY_CHANGED`, `EMPLOYEE_ONBOARDED` and friends — and
 * not one of them is a name anything in the codebase emits, so a preference
 * saved against any of them could never have matched a notification. The names
 * below are the audit actions `notification.service.js` has templates for, and
 * `notification.service.test.js` asserts the two stay in step.
 */

/** Every event a user can express a preference about. */
const NOTIFICATION_EVENT_TYPES = [
  'PAYROLL_APPROVE',
  'PAYROLL_REJECT',
  'PAYROLL_FINALIZE',
  'EXPENSE_SUBMIT',
  'LOAN_ISSUE',
  'LOAN_STATUS_CHANGE',
  'WORKFLOW_INSTANCE_START',
  'WORKFLOW_TRANSITION',
  'SETTLEMENT_STATUS_CHANGE',
  'EMPLOYEE_EXIT_INITIATED',
];

/**
 * The delivery channels a provider is registered for.
 *
 * Must match the keys `notifications/registry.js` registers, which is what
 * `registry.get(channel)` throws on.
 */
const NOTIFICATION_CHANNELS = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  SLACK: 'slack',
};

const ALL_NOTIFICATION_CHANNELS = Object.values(NOTIFICATION_CHANNELS);

/**
 * What a user gets when they have never expressed a preference.
 *
 * The bell only. Mailing somebody by default because an event fired is how a
 * product teaches people to filter its mail.
 */
const DEFAULT_CHANNELS = [NOTIFICATION_CHANNELS.IN_APP];

module.exports = {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_CHANNELS,
  ALL_NOTIFICATION_CHANNELS,
  DEFAULT_CHANNELS,
};
