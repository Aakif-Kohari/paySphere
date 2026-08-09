/**
 * Audit Stream Socket
 *
 * Exposes a `/audit-stream` Socket.IO namespace that pushes audit log events
 * to subscribed compliance officer clients in real time.
 *
 * Architecture:
 *   Controller → eventBus.emit(AUDIT_LOG) → audit.listener (persists to DB)
 *                                          → auditStream.socket (broadcasts)
 *                                          → AuditAlertRulesService (alerts)
 *
 * Wired to the same in-process EventEmitter used by `audit.listener.js` so
 * zero latency overhead is introduced compared to polling, and no controller
 * changes are required — all 33 existing `emitAuditLog` calls broadcast
 * automatically.
 *
 * Call `initAuditStream(io)` once from `index.js` after Socket.IO creation.
 */
'use strict';

const logger  = require('../utils/logger');
const eventBus = require('../services/event.service');
const { AuditAlertRulesService } = require('../services/auditAlertRules.service');

const { AUDIT_LOG_EVENT } = eventBus;

let _ns = null; // Socket.IO namespace (singleton)

/**
 * Attach the `/audit-stream` namespace to the Socket.IO server.
 *
 * @param {import('socket.io').Server} io
 */
function initAuditStream(io) {
  if (_ns) return; // idempotent — safe to call twice in tests
  _ns = io.of('/audit-stream');

  _ns.on('connection', (socket) => {
    logger.info('Audit stream client connected', { socketId: socket.id });

    // Send the last 20 audit events so the client gets an immediate snapshot
    const AuditLog = require('../models/auditLog.model');
    AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .then((recent) => socket.emit('audit:history', recent.reverse()))
      .catch((err) =>
        logger.error('Failed to fetch audit history for stream', { error: err.message }),
      );

    socket.on('disconnect', () =>
      logger.info('Audit stream client disconnected', { socketId: socket.id }),
    );
  });

  // Subscribe to in-process EventBus — same emitter as audit.listener.js
  eventBus.on(AUDIT_LOG_EVENT, async (payload) => {
    if (!_ns) return;

    // 1. Broadcast the raw event to all connected clients
    _ns.emit('audit:event', payload);

    // 2. Evaluate alert rules — broadcast any that fire
    const alerts = await AuditAlertRulesService.evaluate(payload);
    for (const alert of alerts) {
      _ns.emit('audit:alert', alert);
    }
  });

  logger.info('Audit stream namespace initialised', { namespace: '/audit-stream' });
}

module.exports = { initAuditStream };
