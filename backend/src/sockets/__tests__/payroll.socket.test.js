const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');

jest.mock('../../models/user.model');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

/**
 * A stand-in for the socket.io server.
 *
 * Captures the handshake middleware and the connection handler so each can be
 * driven directly. The alternative — an HTTP server and real socket.io-client
 * connections — would test socket.io rather than the room-keying decision this
 * suite is about.
 */
const mockRooms = [];
const mockEmissions = [];

jest.mock('socket.io', () =>
  jest.fn(() => ({
    use: jest.fn(function (fn) {
      this.handshake = fn;
      return this;
    }),
    on: jest.fn(function (event, fn) {
      if (event === 'connection') this.connection = fn;
      return this;
    }),
    to: jest.fn((room) => ({
      emit: (event, payload) => mockEmissions.push({ room, event, payload }),
    })),
  })),
);

const socketIo = require('socket.io');

const oid = () => new mongoose.Types.ObjectId().toString();

const USER_A = oid();
const TENANT_A = oid();
const TENANT_B = oid();
const SECRET = 'test-secret';

/** A fake client socket the handlers can be driven through. */
const makeSocket = (id = 'socket-1') => {
  const handlers = {};

  return {
    id,
    handshake: { auth: {} },
    join: jest.fn(function (room) {
      mockRooms.push({ socketId: id, room });
    }),
    on: jest.fn(function (event, fn) {
      handlers[event] = fn;
    }),
    emit: jest.fn((event, payload) =>
      mockEmissions.push({ to: id, event, payload }),
    ),
    to: jest.fn((room) => ({
      emit: (event, payload) =>
        mockEmissions.push({ room, event, payload, excluding: id }),
    })),
    fire: (event, payload) => handlers[event] && handlers[event](payload),
    has: (event) => Boolean(handlers[event]),
  };
};

const payrollSocket = require('../payroll.socket');

/**
 * Boot the server and return the captured hooks.
 *
 * No `jest.resetModules()`: the secret is read inside `init()`, so a fresh
 * module registry is not needed — and resetting it would hand the module under
 * test an unmocked `User` and a different `socket.io` than the one asserted on.
 */
const boot = () => {
  const io = payrollSocket.init({});
  payrollSocket.getPresence().clear();

  return { payrollSocket, io };
};

/** Run the handshake and return the error it produced, or null. */
const shakeHands = async (io, socket) => {
  let error = null;
  await io.handshake(socket, (err) => {
    error = err || null;
  });

  return error;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRooms.length = 0;
  mockEmissions.length = 0;
  process.env.JWT_SECRET = SECRET;
  User.findById.mockReturnValue({
    select: () => ({
      lean: async () => ({
        _id: USER_A,
        isActive: true,
        tenantId: TENANT_A,
        fullName: 'Ada Lovelace',
      }),
    }),
  });
});

describe('init — the signing secret (#615)', () => {
  test('refuses to start without JWT_SECRET', () => {
    delete process.env.JWT_SECRET;

    // `#589` ORed the variable with a hardcoded default, which accepted tokens
    // anyone could forge and made the misconfiguration invisible.
    expect(() => boot()).toThrow(/JWT_SECRET is not set/);
  });

  test('never ORs the environment variable with a default', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'payroll.socket.js'),
      'utf8',
    );

    // The exact shape of the #589 bug: `process.env.JWT_SECRET || '...'`.
    expect(source).not.toMatch(/process\.env\.JWT_SECRET\s*\|\|/);
  });

  test('starts when the secret is set', () => {
    expect(() => boot()).not.toThrow();
    expect(socketIo).toHaveBeenCalled();
  });
});

describe('handshake (#615)', () => {
  test('rejects a connection with no token', async () => {
    const { io } = boot();

    expect(await shakeHands(io, makeSocket())).toBeInstanceOf(Error);
  });

  test('rejects a token signed with the wrong secret', async () => {
    const { io } = boot();
    const socket = makeSocket();
    socket.handshake.auth.token = jwt.sign(
      { id: USER_A },
      'someone-elses-secret',
    );

    expect(await shakeHands(io, socket)).toBeInstanceOf(Error);
  });

  test('accepts a valid token and resolves the identity', async () => {
    const { io } = boot();
    const socket = makeSocket();
    socket.handshake.auth.token = jwt.sign({ id: USER_A }, SECRET);

    expect(await shakeHands(io, socket)).toBeNull();
    expect(socket.identity).toEqual({
      userId: USER_A,
      tenantId: TENANT_A,
      name: 'Ada Lovelace',
    });
  });

  test('reads the display name from the account, not the token', async () => {
    const { io } = boot();
    const socket = makeSocket();
    // The JWT does not carry fullName, so `#589`'s `socket.user.fullName ||
    // 'Admin'` rendered every participant as "Admin".
    socket.handshake.auth.token = jwt.sign({ id: USER_A }, SECRET);

    await shakeHands(io, socket);

    expect(socket.identity.name).toBe('Ada Lovelace');
  });

  test('refuses a socket with no resolvable tenant rather than sharing a room', async () => {
    User.findById.mockReturnValue({
      select: () => ({ lean: async () => ({ _id: USER_A, isActive: true }) }),
    });
    const { io } = boot();
    const socket = makeSocket();
    socket.handshake.auth.token = jwt.sign({ id: USER_A }, SECRET);

    expect(await shakeHands(io, socket)).toBeInstanceOf(Error);
  });

  test('refuses a deactivated account', async () => {
    User.findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: USER_A,
          isActive: false,
          tenantId: TENANT_A,
        }),
      }),
    });
    const { io } = boot();
    const socket = makeSocket();
    socket.handshake.auth.token = jwt.sign({ id: USER_A }, SECRET);

    expect(await shakeHands(io, socket)).toBeInstanceOf(Error);
  });

  test('rejects a token that declares itself as something other than an access token', async () => {
    const { io } = boot();
    const socket = makeSocket();
    // Forward-compatible with #557, whose fix stamps a type at signing time.
    socket.handshake.auth.token = jwt.sign(
      { id: USER_A, type: 'refresh' },
      SECRET,
    );

    expect(await shakeHands(io, socket)).toBeInstanceOf(Error);
  });

  test('a lookup failure closes the connection rather than letting it through', async () => {
    User.findById.mockImplementation(() => {
      throw new Error('connection lost');
    });
    const { io } = boot();
    const socket = makeSocket();
    socket.handshake.auth.token = jwt.sign({ id: USER_A }, SECRET);

    expect(await shakeHands(io, socket)).toBeInstanceOf(Error);
  });
});

describe('join_payroll_session — the room is per company (#615)', () => {
  const connect = async (tenantId, socketId) => {
    const { io } = boot();
    const socket = makeSocket(socketId);
    socket.identity = { userId: USER_A, tenantId, name: 'Ada' };
    io.connection(socket);

    return socket;
  };

  /** The payroll session room, ignoring the per-user room joined at connect. */
  const payrollRooms = () =>
    mockRooms.filter((r) => !r.room.startsWith('user:'));

  test('joins a room keyed by the tenant resolved at handshake', async () => {
    const socket = await connect(TENANT_A, 's1');

    socket.fire('join_payroll_session', { month: 8, year: 2026 });

    expect(payrollRooms()[0].room).toContain(TENANT_A);
    // Under `#589` this was the bare string "8-2026".
    expect(payrollRooms()[0].room).not.toBe('8-2026');
  });

  test('every socket joins its own user room, for notification pushes (#952)', async () => {
    const socket = await connect(TENANT_A, 's1');

    // The room the notification registry publishes to. Keyed off the verified
    // identity, never off a payload — the same rule as the payroll room below.
    expect(socket.join).toHaveBeenCalledWith(`user:${USER_A}`);
  });

  test('two companies opening the same month land in different rooms', async () => {
    const a = await connect(TENANT_A, 's1');
    a.fire('join_payroll_session', { month: 8, year: 2026 });
    const roomA = payrollRooms().at(-1).room;

    const b = await connect(TENANT_B, 's2');
    b.fire('join_payroll_session', { month: 8, year: 2026 });
    const roomB = payrollRooms().at(-1).room;

    expect(roomA).not.toBe(roomB);
  });

  test('the room key ignores a tenant supplied in the payload', async () => {
    const socket = await connect(TENANT_A, 's1');

    // A room key a client can influence is a room key a client can join.
    socket.fire('join_payroll_session', {
      month: 8,
      year: 2026,
      tenantId: TENANT_B,
    });

    expect(payrollRooms()[0].room).toContain(TENANT_A);
    expect(payrollRooms()[0].room).not.toContain(TENANT_B);
  });

  test('an invalid period joins nothing and tells the caller', async () => {
    const socket = await connect(TENANT_A, 's1');

    socket.fire('join_payroll_session', { month: '*', year: '*' });

    // The user room is joined at connection; no payroll room is.
    expect(payrollRooms()).toHaveLength(0);
    expect(mockEmissions.some((e) => e.event === 'payroll_session_error')).toBe(
      true,
    );
  });

  test('a missing payload does not throw', async () => {
    const socket = await connect(TENANT_A, 's1');

    expect(() => socket.fire('join_payroll_session', undefined)).not.toThrow();
    expect(payrollRooms()).toHaveLength(0);
  });
});

describe('payroll_adjustment_change (#615)', () => {
  const connectAndJoin = async () => {
    const { io } = boot();
    const socket = makeSocket('s1');
    socket.identity = { userId: USER_A, tenantId: TENANT_A, name: 'Ada' };
    io.connection(socket);
    socket.fire('join_payroll_session', { month: 8, year: 2026 });
    mockEmissions.length = 0;

    return socket;
  };

  test('broadcasts to the company room only', async () => {
    const socket = await connectAndJoin();
    const empId = oid();

    socket.fire('payroll_adjustment_change', {
      empId,
      field: 'bonus',
      value: 5000,
    });

    const sync = mockEmissions.find(
      (e) => e.event === 'payroll_adjustment_sync',
    );
    expect(sync.room).toContain(TENANT_A);
    expect(sync.payload).toMatchObject({ empId, field: 'bonus', value: 5000 });
  });

  test('the sender is the authenticated user, not whatever the payload claims', async () => {
    const socket = await connectAndJoin();

    socket.fire('payroll_adjustment_change', {
      empId: oid(),
      field: 'bonus',
      value: 1,
      userId: 'someone-else',
      userName: 'Impersonated',
    });

    const sync = mockEmissions.find(
      (e) => e.event === 'payroll_adjustment_sync',
    );
    // `#589` spread the payload *after* setting these, so the client won.
    expect(sync.payload.userId).toBe(USER_A);
    expect(sync.payload.userName).toBe('Ada');
  });

  test('a malformed payload is refused rather than relayed', async () => {
    const socket = await connectAndJoin();

    socket.fire('payroll_adjustment_change', { empId: 'nope', field: 'bonus' });

    expect(
      mockEmissions.some((e) => e.event === 'payroll_adjustment_sync'),
    ).toBe(false);
    expect(mockEmissions.some((e) => e.event === 'payroll_session_error')).toBe(
      true,
    );
  });

  test('a socket that has not joined broadcasts nothing', async () => {
    const { io } = boot();
    const socket = makeSocket('s1');
    socket.identity = { userId: USER_A, tenantId: TENANT_A, name: 'Ada' };
    io.connection(socket);

    socket.fire('payroll_adjustment_change', {
      empId: oid(),
      field: 'bonus',
      value: 1,
    });

    expect(mockEmissions).toHaveLength(0);
  });
});

describe('payroll row locks (#813)', () => {
  const customConnectAndJoin = async (
    socketId = 's1',
    userId = USER_A,
    userName = 'Ada',
  ) => {
    const { io } = boot();
    const socket = makeSocket(socketId);
    socket.identity = { userId, tenantId: TENANT_A, name: userName };
    io.connection(socket);
    socket.fire('join_payroll_session', { month: 8, year: 2026 });
    mockEmissions.length = 0;
    return socket;
  };

  let employeeId;

  beforeEach(() => {
    employeeId = oid();
    const { getLocksRegistry } = require('../payroll.socket');
    if (getLocksRegistry()) {
      getLocksRegistry().clear();
    }
  });

  test('should emit active_locks_update when user joins the session', async () => {
    const { io } = boot();
    const socket = makeSocket('s1');
    socket.identity = { userId: USER_A, tenantId: TENANT_A, name: 'Ada' };
    io.connection(socket);
    socket.fire('join_payroll_session', { month: 8, year: 2026 });

    const activeLocksUpdate = mockEmissions.find(
      (e) => e.event === 'active_locks_update',
    );
    expect(activeLocksUpdate).toBeDefined();
    expect(activeLocksUpdate.payload).toEqual([]);
  });

  test('should broadcast payroll_row_locked when a user successfully locks a row', async () => {
    const socket = await customConnectAndJoin();
    socket.fire('payroll_row_lock', { empId: employeeId });

    const lockedEvent = mockEmissions.find(
      (e) => e.event === 'payroll_row_locked',
    );
    expect(lockedEvent).toBeDefined();
    expect(lockedEvent.payload).toMatchObject({
      userId: USER_A,
      userName: 'Ada',
      empId: employeeId,
    });
  });

  test('should broadcast payroll_row_unlocked when a user unlocks a row', async () => {
    const socket = await customConnectAndJoin();
    socket.fire('payroll_row_lock', { empId: employeeId });
    socket.fire('payroll_row_unlock', { empId: employeeId });

    const unlockedEvent = mockEmissions.find(
      (e) => e.event === 'payroll_row_unlocked',
    );
    expect(unlockedEvent).toBeDefined();
    expect(unlockedEvent.payload).toMatchObject({
      userId: USER_A,
      userName: 'Ada',
      empId: employeeId,
    });
  });

  test('should fail to lock if the row is already locked by someone else', async () => {
    const { io } = boot();

    // First client socket
    const socket1 = makeSocket('s1');
    socket1.identity = { userId: USER_A, tenantId: TENANT_A, name: 'Ada' };
    io.connection(socket1);
    socket1.fire('join_payroll_session', { month: 8, year: 2026 });

    // Second client socket
    const socket2 = makeSocket('s2');
    const USER_B = oid();
    socket2.identity = { userId: USER_B, tenantId: TENANT_A, name: 'Bob' };
    io.connection(socket2);
    socket2.fire('join_payroll_session', { month: 8, year: 2026 });

    mockEmissions.length = 0;

    // Socket 1 acquires lock
    socket1.fire('payroll_row_lock', { empId: employeeId });
    // Socket 2 tries to acquire the same lock
    socket2.fire('payroll_row_lock', { empId: employeeId });

    const errorEvent = mockEmissions.find(
      (e) => e.to === 's2' && e.event === 'payroll_session_error',
    );
    expect(errorEvent).toBeDefined();
    expect(errorEvent.payload.message).toContain('Failed to acquire row lock');
  });

  test('should automatically unlock rows when the user disconnects', async () => {
    const socket = await customConnectAndJoin();
    socket.fire('payroll_row_lock', { empId: employeeId });

    socket.fire('disconnect');
    const unlockedEvent = mockEmissions.find(
      (e) => e.event === 'payroll_row_unlocked',
    );
    expect(unlockedEvent).toBeDefined();
    expect(unlockedEvent.payload.empId).toBe(employeeId);
  });
});

describe('logging (#615)', () => {
  test('connections are not written to stdout with console.log', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'payroll.socket.js'),
      'utf8',
    );

    expect(source).not.toContain('console.log');
  });

  test('a connection is logged through the shared logger', async () => {
    const logger = require('../../utils/logger');
    const { io } = boot();
    const socket = makeSocket();
    socket.identity = { userId: USER_A, tenantId: TENANT_A, name: 'Ada' };

    io.connection(socket);

    expect(logger.info).toHaveBeenCalledWith(
      'Payroll session socket connected',
      expect.objectContaining({ userId: USER_A, tenantId: TENANT_A }),
    );
  });
});
