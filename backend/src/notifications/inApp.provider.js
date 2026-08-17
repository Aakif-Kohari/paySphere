'use strict';
const BaseProvider = require('./base.provider');
const Notification = require('../models/notification.model');
const logger       = require('../utils/logger');
class InAppProvider extends BaseProvider {
  constructor(io = null) { super(); this._io = io; }
  async send({ to, subject, body, metadata = {} }) {
    try {
      const n = await Notification.create({ userId: to, tenantId: metadata.tenantId || null, title: subject, message: body, type: metadata.type || 'INFO', isRead: false, metadata });
      if (this._io) this._io.to('user:' + to).emit('notification:new', n);
      logger.info('In-app notification delivered', { userId: to, notificationId: n._id });
    } catch (err) { logger.error('InAppProvider.send failed', { to, error: err.message }); throw err; }
  }
}
module.exports = InAppProvider;