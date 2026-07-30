const EventEmitter = require('events');
const logger = require('../utils/logger');

class EventBus extends EventEmitter {}

const eventBus = new EventBus();

/**
 * Canonical name of the audit-log event. Controllers should prefer this
 * constant over a bare string literal so a typo cannot silently produce an
 * event that no listener is subscribed to.
 */
const AUDIT_LOG_EVENT = 'AUDIT_LOG';

/**
 * Emit an audit-log event without ever throwing.
 *
 * Audit logging in PaySphere is deliberately fire-and-forget (see #390): the
 * request must not wait on, or be failed by, the audit write. Controllers call
 * this *after* their database mutation has committed, so anything thrown here
 * would surface to the client as a 500 for an operation that actually
 * succeeded — which is exactly the failure mode reported in #411.
 *
 * `EventEmitter.emit` is synchronous, so a listener that throws synchronously
 * would propagate straight back into the controller. Wrapping the emit keeps
 * that blast radius inside the audit layer.
 *
 * @param {object} payload Audit payload forwarded to `createAuditLog`.
 * @returns {boolean} `true` if the event was emitted cleanly, `false` otherwise.
 */
function emitAuditLog(payload) {
  try {
    eventBus.emit(AUDIT_LOG_EVENT, payload);
    return true;
  } catch (error) {
    logger.error('Failed to emit AUDIT_LOG event', {
      action: payload?.action,
      resourceType: payload?.resourceType,
      error: error.message,
    });
    return false;
  }
}

// Exported as properties on the emitter instance so that existing callers doing
// `const eventBus = require("../services/event.service")` and then
// `eventBus.emit("AUDIT_LOG", ...)` keep working unchanged.
eventBus.AUDIT_LOG_EVENT = AUDIT_LOG_EVENT;
eventBus.emitAuditLog = emitAuditLog;

module.exports = eventBus;
