'use strict';
const BaseProvider = require('./base.provider');
const logger       = require('../utils/logger');
class SlackProvider extends BaseProvider {
  constructor() { super(); this._url = process.env.SLACK_WEBHOOK_URL; }
  async send({ to, subject, body }) {
    if (!this._url) { logger.warn('SlackProvider: SLACK_WEBHOOK_URL not set', { to }); return; }
    try {
      const r = await fetch(this._url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '*' + subject + '*\n' + body }) });
      if (!r.ok) throw new Error('Slack webhook returned ' + r.status);
      logger.info('Slack notification delivered', { subject });
    } catch (err) { logger.error('SlackProvider.send failed', { error: err.message }); throw err; }
  }
}
module.exports = SlackProvider;