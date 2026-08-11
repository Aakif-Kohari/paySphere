'use strict';
const BaseProvider  = require('./base.provider');
const EmailProvider = require('./email.provider');
const InAppProvider = require('./inApp.provider');
const SlackProvider = require('./slack.provider');
const logger        = require('../utils/logger');
const _p = new Map();
function register(channel, provider) {
  if (!(provider instanceof BaseProvider)) throw new TypeError((provider && provider.constructor && provider.constructor.name) + ' must extend BaseProvider');
  _p.set(channel.toLowerCase(), provider);
  logger.info('Notification provider registered', { channel });
}
function get(channel) {
  const p = _p.get(channel.toLowerCase());
  if (!p) throw new Error('No notification provider for channel "' + channel + '"');
  return p;
}
function listChannels() { return Array.from(_p.keys()); }
function setIO(io) { const inApp = _p.get('in_app'); if (inApp) inApp._io = io; }
register('email',  new EmailProvider());
register('in_app', new InAppProvider());
register('slack',  new SlackProvider());
module.exports = { register, get, listChannels, setIO };