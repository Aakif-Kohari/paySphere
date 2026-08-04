const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
// We store active viewers per payroll session: payrollSessionId -> Map of userId -> userInfo
const activeSessions = new Map();

exports.init = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected to socket:', socket.user.id);

    socket.on('join_payroll_session', ({ month, year }) => {
      const sessionId = `${month}-${year}`;
      socket.join(sessionId);
      socket.sessionId = sessionId;

      if (!activeSessions.has(sessionId)) {
        activeSessions.set(sessionId, new Map());
      }
      const sessionUsers = activeSessions.get(sessionId);
      sessionUsers.set(socket.user.id, { id: socket.user.id, name: socket.user.fullName || 'Admin' });

      io.to(sessionId).emit('active_users_update', Array.from(sessionUsers.values()));
    });

    socket.on('payroll_adjustment_change', (data) => {
      // data: { empId, field, value }
      if (socket.sessionId) {
        // Broadcast to everyone else in the room
        socket.to(socket.sessionId).emit('payroll_adjustment_sync', {
          userId: socket.user.id,
          userName: socket.user.fullName || 'Admin',
          ...data
        });
      }
    });

    socket.on('disconnect', () => {
      if (socket.sessionId && activeSessions.has(socket.sessionId)) {
        const sessionUsers = activeSessions.get(socket.sessionId);
        sessionUsers.delete(socket.user.id);
        io.to(socket.sessionId).emit('active_users_update', Array.from(sessionUsers.values()));
        if (sessionUsers.size === 0) {
          activeSessions.delete(socket.sessionId);
        }
      }
    });
  });
};

exports.getIo = () => io;
