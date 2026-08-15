const mongoose = require('mongoose');

/**
 * Room keys and presence bookkeeping for the collaborative payroll session
 * (#589, made tenant-safe in #615).
 *
 * Kept apart from payroll.socket.js because the bug this fixes lives entirely
 * in one expression:
 *
 *     const sessionId = `${month}-${year}`;
 *
 * Every company running August 2026 joined room "8-2026". `socket.to(room)` then
 * re-broadcast one admin's salary edit — employee id and new value — to every
 * other company with that month open, and `active_users_update` handed out the
 * name of every admin in the room alongside it.
 *
 * The tenant belongs in the key, and the key has to be built from the
 * *authenticated socket*, never from the client's payload. Pure functions here
 * so that is directly assertable.
 */

/** Room-key segments are joined with this. Not a character that appears in an id. */
const SEPARATOR = ':';

/**
 * Is this a period a room can be opened for?
 *
 * `#589` interpolated whatever arrived into the key, so `join_payroll_session`
 * with `{ month: '*', year: '*' }` produced a room named `"*-*"` that anyone
 * else sending the same payload would share.
 *
 * @param {*} month
 * @param {*} year
 * @returns {boolean}
 */
function isValidPeriod(month, year) {
  const m = Number(month);
  const y = Number(year);

  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return false;

  return true;
}

/**
 * The room a company's payroll session for one period lives in.
 *
 * @param {string} tenantId resolved from the socket, not from the client
 * @param {number|string} month
 * @param {number|string} year
 * @returns {string|null} null when the period or tenant is unusable
 */
function roomIdFor(tenantId, month, year) {
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) return null;
  if (!isValidPeriod(month, year)) return null;

  return `${String(tenantId)}${SEPARATOR}${Number(month)}-${Number(year)}`;
}

/**
 * Who is in which room.
 *
 * `#589` kept one entry per user id, so a second browser tab overwrote the
 * first and closing either tab removed the user from the roster while they were
 * still connected. Each user now holds the set of their own socket ids, and
 * they only leave when the last one goes.
 */
class PresenceRegistry {
  constructor() {
    /** @type {Map<string, Map<string, {id: string, name: string, sockets: Set<string>}>>} */
    this.rooms = new Map();
  }

  /**
   * Record a connection, and return the room's roster.
   *
   * @param {string} roomId
   * @param {{id: string, name: string, socketId: string}} member
   * @returns {Array<{id: string, name: string}>}
   */
  join(roomId, { id, name, socketId }) {
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map());
    const members = this.rooms.get(roomId);

    const existing = members.get(id);
    if (existing) {
      existing.sockets.add(socketId);
      // A later connection may know the name when an earlier one did not.
      if (name) existing.name = name;
    } else {
      members.set(id, { id, name, sockets: new Set([socketId]) });
    }

    return this.roster(roomId);
  }

  /**
   * Record a disconnection, and return the room's roster.
   *
   * @param {string} roomId
   * @param {{id: string, socketId: string}} member
   * @returns {Array<{id: string, name: string}>}
   */
  leave(roomId, { id, socketId }) {
    const members = this.rooms.get(roomId);
    if (!members) return [];

    const existing = members.get(id);
    if (existing) {
      existing.sockets.delete(socketId);
      // Still here on another tab.
      if (existing.sockets.size === 0) members.delete(id);
    }

    if (members.size === 0) this.rooms.delete(roomId);

    return this.roster(roomId);
  }

  /**
   * The room's roster, without the internal socket bookkeeping.
   *
   * @param {string} roomId
   * @returns {Array<{id: string, name: string}>}
   */
  roster(roomId) {
    const members = this.rooms.get(roomId);
    if (!members) return [];

    return [...members.values()].map(({ id, name }) => ({ id, name }));
  }

  /** @returns {number} rooms currently held open */
  size() {
    return this.rooms.size;
  }

  /** Drop everything. For tests and for a clean shutdown. */
  clear() {
    this.rooms.clear();
  }
}

class LockRegistry {
  constructor() {
    /** @type {Map<string, Map<string, {userId: string, userName: string, socketId: string}>>} */
    this.rooms = new Map();
  }

  acquire(roomId, empId, { userId, userName, socketId }) {
    if (!roomId || !empId || !mongoose.Types.ObjectId.isValid(empId)) return false;
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map());
    
    const locks = this.rooms.get(roomId);
    const existing = locks.get(String(empId));
    if (existing && existing.socketId !== socketId) {
      return false;
    }
    
    locks.set(String(empId), { userId, userName, socketId });
    return true;
  }

  release(roomId, empId, socketId) {
    const locks = this.rooms.get(roomId);
    if (!locks) return false;

    const existing = locks.get(String(empId));
    if (existing && existing.socketId === socketId) {
      locks.delete(String(empId));
      if (locks.size === 0) this.rooms.delete(roomId);
      return true;
    }
    return false;
  }

  releaseAllForSocket(roomId, socketId) {
    const locks = this.rooms.get(roomId);
    if (!locks) return [];

    const releasedEmpIds = [];
    for (const [empId, lock] of locks.entries()) {
      if (lock.socketId === socketId) {
        locks.delete(empId);
        releasedEmpIds.push(empId);
      }
    }
    if (locks.size === 0) this.rooms.delete(roomId);
    return releasedEmpIds;
  }

  getLocks(roomId) {
    const locks = this.rooms.get(roomId);
    if (!locks) return [];

    return [...locks.entries()].map(([empId, lock]) => ({
      empId,
      userId: lock.userId,
      userName: lock.userName,
    }));
  }

  clear() {
    this.rooms.clear();
  }
}

/**
 * Is this adjustment payload something worth re-broadcasting?
 *
 * `#589` spread whatever arrived straight into the outgoing event, so a client
 * could push arbitrary keys — including ones that collide with the fields the
 * server sets — into every other participant's handler.
 *
 * @param {*} data
 * @returns {{ok: true, payload: {empId: string, field: string, value: *}} | {ok: false}}
 */
function normalizeAdjustment(data) {
  if (!data || typeof data !== 'object') return { ok: false };

  const { empId, field, value } = data;

  if (!mongoose.Types.ObjectId.isValid(empId)) return { ok: false };
  if (typeof field !== 'string' || field.trim() === '') return { ok: false };

  return { ok: true, payload: { empId: String(empId), field, value } };
}

module.exports = {
  SEPARATOR,
  isValidPeriod,
  roomIdFor,
  PresenceRegistry,
  LockRegistry,
  normalizeAdjustment,
};
