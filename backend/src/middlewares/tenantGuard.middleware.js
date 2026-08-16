'use strict';
const { isUsableTenantId } = require('../utils/tenantScope');
const logger = require('../utils/logger');
function tenantGuard() {
  return (req, res, next) => {
    const doc = res.locals.document;
    if (!doc) { logger.warn('tenantGuard: res.locals.document not set', { path: req.path }); return next(); }
    const r = req.tenantId; const d = doc.tenantId;
    if (!isUsableTenantId(r) || !isUsableTenantId(d)) {
      return res.status(403).json({ message: 'Access denied: resource does not belong to your account.' });
    }
    if (String(r) !== String(d)) {
      logger.warn('tenantGuard: cross-tenant access blocked', { userId: req.userId, path: req.path });
      return res.status(403).json({ message: 'Access denied: resource does not belong to your account.' });
    }
    next();
  };
}
module.exports = { tenantGuard };