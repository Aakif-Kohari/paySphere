const { login } = require('../user.controller');
const User = require('../../models/user.model');
const bcrypt = require('bcryptjs');

jest.mock('../../models/user.model');
jest.mock('bcryptjs');
jest.mock('../../services/tenant.service', () => ({
  ensureTenantForUser: jest.fn().mockResolvedValue(true),
}));

describe('Account Lockout Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {
        email: 'user@example.com',
        password: 'Password123!',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
    next = jest.fn();
  });

  it('should increment failedLoginAttempts on invalid password', async () => {
    const mockUser = {
      _id: 'u1',
      email: 'user@example.com',
      password: 'hashedpassword',
      failedLoginAttempts: 2,
      lockUntil: null,
      save: jest.fn().mockResolvedValue(true),
    };

    User.findOne.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(false);

    await login(req, res, next);

    expect(mockUser.failedLoginAttempts).toBe(3);
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid credentials',
        remainingAttempts: 2,
      })
    );
  });

  it('should lock account for 30 minutes on 5th failed login attempt', async () => {
    const mockUser = {
      _id: 'u1',
      email: 'user@example.com',
      password: 'hashedpassword',
      failedLoginAttempts: 4,
      lockUntil: null,
      save: jest.fn().mockResolvedValue(true),
    };

    User.findOne.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(false);

    await login(req, res, next);

    expect(mockUser.failedLoginAttempts).toBe(5);
    expect(mockUser.lockUntil).toBeInstanceOf(Date);
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        isLocked: true,
        message: expect.stringContaining('Account locked due to 5 consecutive failed login attempts'),
      })
    );
  });

  it('should reject login if account is currently locked', async () => {
    const lockUntilDate = new Date(Date.now() + 20 * 60 * 1000); // Locked for 20 more mins
    const mockUser = {
      _id: 'u1',
      email: 'user@example.com',
      failedLoginAttempts: 5,
      lockUntil: lockUntilDate,
    };

    User.findOne.mockResolvedValue(mockUser);

    await login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        isLocked: true,
        message: expect.stringContaining('Account is locked'),
      })
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('should clear failed attempts counter on successful login', async () => {
    const mockUser = {
      _id: 'u1',
      email: 'user@example.com',
      password: 'hashedpassword',
      failedLoginAttempts: 3,
      lockUntil: null,
      companyName: 'Test Corp',
      save: jest.fn().mockResolvedValue(true),
    };

    User.findOne.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);

    process.env.JWT_SECRET = 'secret';

    await login(req, res, next);

    expect(mockUser.failedLoginAttempts).toBe(0);
    expect(mockUser.lockUntil).toBeNull();
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
