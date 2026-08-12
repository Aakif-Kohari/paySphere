'use strict';
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
function correlationMiddleware() {
  return (req, res, next) => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    let traceId = '';
    try { const { trace } = require('@opentelemetry/api'); const s = trace.getActiveSpan(); if (s) traceId = s.spanContext().traceId; } catch (_e) {}
    res.locals.requestId = requestId;
    res.locals.traceId = traceId;
    logger.debug('Request started', { requestId, traceId: traceId || undefined, method: req.method, path: req.path });
    res.on('finish', () => logger.debug('Request finished', { requestId, statusCode: res.statusCode }));
    next();
  };
}
module.exports = { correlationMiddleware };