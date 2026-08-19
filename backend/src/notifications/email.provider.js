'use strict';
const BaseProvider = require('./base.provider');
const logger       = require('../utils/logger');
class EmailProvider extends BaseProvider {
  async send({ to, subject, body }) {
    try {
      const svc = require('../services/email.service');
      await svc.sendEmail({ to, subject, html: body });
      logger.info('Email notification delivered', { to });
    } catch (err) { logger.error('EmailProvider.send failed', { to, error: err.message }); throw err; }
  }
}
module.exports = EmailProvider;