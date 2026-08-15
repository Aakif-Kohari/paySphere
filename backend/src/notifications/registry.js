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
function has(channel) { return _p.has(String(channel || '').toLowerCase()); }

// The socket server, handed over once at boot by `sockets/payroll.socket.js`.
// Nothing called `setIO` until #952 — `grep -rn "setIO" src` matched only this
// line and the export — so `InAppProvider._io` stayed null, the live push never
// happened, and the bell updated only when the navbar next polled.
let _io = null;

function setIO(io) {
  _io = io;
  const inApp = _p.get('in_app');
  if (inApp) inApp._io = io;
}

/**
 * Push an event to one user's room, if a socket server has been set.
 *
 * A no-op before `setIO`, which is the correct behaviour under test and in any
 * process that has no HTTP server attached — a worker, a cron run, a script.
 *
 * @param {string} userId
 * @param {string} event
 * @param {object} payload
 * @returns {boolean} whether it was emitted
 */
function emitToUser(userId, event, payload) {
  if (!_io || !userId) return false;

  try {
    _io.to('user:' + String(userId)).emit(event, payload);
    return true;
  } catch (err) {
    // A failed push is a missed live update, not a failed notification: the row
    // is already in the collection and the next poll will find it.
    logger.error('Notification socket push failed', { userId: String(userId), error: err.message });
    return false;
  }
}

register('email',  new EmailProvider());
register('in_app', new InAppProvider());
register('slack',  new SlackProvider());
module.exports = { register, get, has, listChannels, setIO, emitToUser };