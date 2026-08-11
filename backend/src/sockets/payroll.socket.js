const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const {
  roomIdFor,
  PresenceRegistry,
  LockRegistry,
  normalizeAdjustment,
} = require('./payrollSession');

/**
 * The collaborative payroll session (#589), made tenant-safe (#615).
 *
 * The room key used to be `${month}-${year}` and nothing else, so every company
 * running August 2026 shared room "8-2026". One admin editing a salary
 * broadcast that employee's id and the new figure to every other company with
 * the same month open, and the presence roster handed out the name of every
 * admin in the room alongside it.
 *
 * The tenant is now part of the key, and it is resolved from the authenticated
 * socket rather than taken from the client's payload — a room key a client can
 * influence is a room key a client can join.
 */

let io;

/** Who is in which room. Module-level so `getPresence` can report on it. */
const presence = new PresenceRegistry();
const locks = new LockRegistry();

/**
 * The signing secret, or a hard failure.
 *
 * `#589` ORed the environment variable with a hardcoded default. A socket server
 * that comes up without a secret and quietly accepts tokens signed with a
 * literal anyone can read out of the repository is worse than one that will not
 * start: the misconfiguration is invisible, because the expression that causes
 * it is also the expression that hides it. auth.middleware.js has never done
 * this, and the test for it greps this file, so the shape cannot come back.
 *
 * @returns {string}
 * @throws {Error} when JWT_SECRET is not set
 */
function requireSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Refusing to start the payroll socket server with a default secret.',
    );
  }

  return secret;
}

/**
 * Everything the socket needs to know about the caller.
 *
 * The tenant comes from the token claim where present, and from the account
 * otherwise, mirroring auth.middleware. The display name comes from the account
 * either way: the JWT does not carry `fullName`, so `#589`'s
 * `socket.user.fullName || 'Admin'` rendered every participant as "Admin".
 *
 * @param {object} decoded the verified JWT payload
 * @returns {Promise<{userId: string, tenantId: string, name: string}|null>}
 */
async function resolveIdentity(decoded) {
  if (!decoded?.id) return null;

  const user = await User.findById(decoded.id)
    .select('_id isActive tenantId fullName')
    .lean();

  if (!user || user.isActive === false) return null;

  const tenantId = user.tenantId || decoded.tenantId || null;
  if (!tenantId) return null;

  return {
    userId: String(user._id),
    tenantId: String(tenantId),
    name: user.fullName || 'Admin',
  };
}

/**
 * Attach the payroll session server.
 *
 * @param {import('http').Server} server
 * @returns {import('socket.io').Server}
 */
exports.init = (server) => {
  const secret = requireSecret();

  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake?.auth?.token;
    if (!token) return next(new Error('Authentication error'));

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return next(new Error('Authentication error'));
    }

    // Refresh tokens are signed with the same secret and carry the same claims,
    // so nothing here can currently tell them apart — that is #557, and its fix
    // is to stamp a type at signing time. This check is written now so it takes
    // effect the moment that lands, rather than being forgotten.
    if (decoded.type && decoded.type !== 'access') {
      return next(new Error('Authentication error'));
    }

    let identity;
    try {
      identity = await resolveIdentity(decoded);
    } catch (error) {
      logger.error('Socket identity lookup failed', { error: error.message });
      return next(new Error('Authentication error'));
    }

    if (!identity) {
      // No tenant means no room this socket can safely be put in. #589 would
      // have dropped it into the shared one.
      return next(new Error('Authentication error'));
    }

    socket.identity = identity;
    return next();
  });

  io.on('connection', (socket) => {
    const { userId, tenantId, name } = socket.identity;

    logger.info('Payroll session socket connected', { userId, tenantId });

    socket.on('join_payroll_session', ({ month, year } = {}) => {
      // Built from `socket.identity.tenantId`, never from the payload.
      const roomId = roomIdFor(tenantId, month, year);

      if (!roomId) {
        // `#589` interpolated whatever arrived, so `{ month: '*', year: '*' }`
        // opened a room called "*-*" that anyone sending the same payload
        // joined.
        socket.emit('payroll_session_error', {
          message: 'Invalid payroll period',
        });
        return;
      }

      socket.join(roomId);
      socket.roomId = roomId;

      const roster = presence.join(roomId, { id: userId, name, socketId: socket.id });

      io.to(roomId).emit('active_users_update', roster);
      socket.emit('active_locks_update', locks.getLocks(roomId));
    });

    socket.on('payroll_adjustment_change', (data) => {
      if (!socket.roomId) return;

      const normalized = normalizeAdjustment(data);
      if (!normalized.ok) {
        // `#589` spread the payload straight into the outgoing event, so a
        // client could push arbitrary keys — including ones that collide with
        // the fields the server sets — to every other participant.
        socket.emit('payroll_session_error', {
          message: 'Invalid adjustment payload',
        });
        return;
      }

      socket.to(socket.roomId).emit('payroll_adjustment_sync', {
        userId,
        userName: name,
        ...normalized.payload,
      });
    });

    socket.on('payroll_row_lock', ({ empId } = {}) => {
      if (!socket.roomId || !empId) return;

      const success = locks.acquire(socket.roomId, empId, {
        userId,
        userName: name,
        socketId: socket.id,
      });

      if (success) {
        socket.to(socket.roomId).emit('payroll_row_locked', {
          userId,
          userName: name,
          empId: String(empId),
        });
      } else {
        socket.emit('payroll_session_error', {
          message: 'Failed to acquire row lock',
        });
      }
    });

    socket.on('payroll_row_unlock', ({ empId } = {}) => {
      if (!socket.roomId || !empId) return;

      const success = locks.release(socket.roomId, empId, socket.id);
      if (success) {
        socket.to(socket.roomId).emit('payroll_row_unlocked', {
          userId,
          userName: name,
          empId: String(empId),
        });
      }
    });

    socket.on('disconnect', () => {
      if (!socket.roomId) return;

      const releasedEmpIds = locks.releaseAllForSocket(socket.roomId, socket.id);
      releasedEmpIds.forEach((empId) => {
        socket.to(socket.roomId).emit('payroll_row_unlocked', {
          userId,
          userName: name,
          empId,
        });
      });

      // Keyed by socket id, so a second tab closing does not remove someone who
      // is still connected on the first.
      const roster = presence.leave(socket.roomId, { id: userId, socketId: socket.id });

      io.to(socket.roomId).emit('active_users_update', roster);
    });
  });

  return io;
};

exports.getIo = () => io;

/** The presence registry, for tests and for a health endpoint to report on. */
exports.getPresence = () => presence;
exports.getLocksRegistry = () => locks;
