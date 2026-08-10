const eventBus = require('../services/event.service');
const { AUDIT_LOG_EVENT } = require('../services/event.service');
const { notifyFromAuditEvent } = require('../services/notification.service');
const logger = require('../utils/logger');

/**
 * The subscriber that turns events into notifications (#898).
 *
 * Deliberately shaped exactly like `audit.listener.js`, for the reason written
 * up in that file: registration is an exported function that `index.js` calls
 * in the same sequence as `seedRbac()` and `startCronJobs()`, *not* a side
 * effect of being required. #664 is what happens otherwise — `audit.listener`
 * registered its handler on require, nothing required it, and thirty-three
 * emits across nine controllers fired into an emitter with no subscribers for
 * the entire life of the product. An import that looks unused is an import
 * somebody deletes; a call in the boot sequence is not.
 *
 * It subscribes to `AUDIT_LOG` rather than to a new event, because the emits
 * are already there, at the right moments, carrying the actor, the tenant and
 * the affected ids. A parallel `NOTIFY` event would mean touching thirty-odd
 * call sites and would drift out of step with the audit ones the first time
 * somebody added a feature and only remembered one of them.
 *
 * Two subscribers on one event is also why `handleNotificationEvent` cannot be
 * allowed to throw: `EventEmitter.emit` is synchronous, so an exception from
 * this listener would propagate back into the controller that emitted — a 500
 * for an operation that had already committed. `emitAuditLog` wraps the emit
 * for the same reason, and this is the belt to that brace.
 */

/** Idempotence guard: registering twice must not double every notification. */
let registered = false;

/**
 * Handle one emitted event.
 *
 * `notifyFromAuditEvent` already refuses to throw, so this catch is for a
 * payload malformed enough to break before it gets there. It matters more than
 * it looks: this runs detached from the request, so an exception escaping here
 * is an unhandled rejection.
 *
 * @param {object} payload
 * @returns {Promise<void>}
 */
async function handleNotificationEvent(payload) {
  try {
    await notifyFromAuditEvent(payload);
  } catch (error) {
    logger.error('Failed to process an event for notifications', {
      action: payload?.action,
      error: error.message,
    });
  }
}

/**
 * Subscribe to `AUDIT_LOG`. Safe to call more than once.
 *
 * @returns {boolean} true if this call performed the registration
 */
function registerNotificationListener() {
  if (registered) return false;

  eventBus.on(AUDIT_LOG_EVENT, handleNotificationEvent);
  registered = true;

  logger.info('Notification listener registered', { event: AUDIT_LOG_EVENT });
  return true;
}

/**
 * Is the notification listener subscribed?
 *
 * Asks the emitter for this specific handler rather than reading the flag or
 * counting listeners — the audit listener is on the same event, so a count
 * would report `true` when only that one is attached, which is precisely the
 * failure this is meant to detect.
 *
 * @returns {boolean}
 */
function isNotificationListenerRegistered() {
  return eventBus.listeners(AUDIT_LOG_EVENT).includes(handleNotificationEvent);
}

/** Test seam: drop the subscription and reset the guard. */
function unregisterNotificationListener() {
  eventBus.off(AUDIT_LOG_EVENT, handleNotificationEvent);
  registered = false;
}

module.exports = {
  registerNotificationListener,
  isNotificationListenerRegistered,
  unregisterNotificationListener,
  handleNotificationEvent,
};
