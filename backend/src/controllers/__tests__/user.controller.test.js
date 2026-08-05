process.env.GOOGLE_CLIENT_ID = 'test-client-id';
const {
  googleAuth,
  updatePassword,
  deleteAccount,
} = require('../user.controller');
const User = require('../../models/user.model');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const AuditLog = require('../../models/auditLog.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const axios = require('axios');

jest.mock('../../services/audit.service', () => ({
  createAuditLog: jest.fn(),
}));
// signup/googleAuth now resolve the default RBAC role when creating an account
// (#413). Stubbed here so these specs do not reach for a real Role document.
jest.mock('../../seeds/rbac.seed', () => ({
  getDefaultRole: jest.fn().mockResolvedValue({ _id: 'role-SuperAdmin' }),
}));
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('axios');
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            sub: 'google123',
            email: 'newuser@example.com',
            name: 'New User',
            picture: 'avatar.png',
          }),
        }),
      };
    }),
  };
});

jest.mock('../../models/user.model', () => {
  const mockConstructor = jest.fn().mockImplementation((data) => {
    return {
      ...data,
      save: jest.fn().mockResolvedValue({}),
    };
  });
  mockConstructor.findOne = jest.fn();
  mockConstructor.findById = jest.fn();
  mockConstructor.findByIdAndDelete = jest.fn();
  return mockConstructor;
});

jest.mock('../../models/employee.model', () => {
  return {
    deleteMany: jest.fn(),
  };
});

jest.mock('../../models/payroll.model', () => {
  return {
    deleteMany: jest.fn(),
  };
});

jest.mock('../../models/auditLog.model', () => {
  return {
    deleteMany: jest.fn(),
  };
});

describe('Google Authentication Controller tests', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {
        credential: 'dummy_id_token',
        companyName: 'Test Company',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
    jwt.sign.mockReturnValue('dummy_jwt_token');
  });

  test("should return 'Account created successfully' for a new Google sign-up", async () => {
    User.findOne.mockResolvedValueOnce(null);

    await googleAuth(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'newuser@example.com' });
    expect(res.status).toHaveBeenCalledWith(201);
    // The Google path returns the account type and employee link too, so the
    // client gets the same shape from every sign-in route (#558).
    expect(res.json).toHaveBeenCalledWith({
      token: 'dummy_jwt_token',
      companyName: 'Test Company',
      role: 'ADMIN',
      employeeId: undefined,
      message: 'Account created successfully',
    });
  });

  test("should return 'Logged in successfully' for an existing user logging in", async () => {
    const existingUser = {
      _id: 'user123',
      email: 'newuser@example.com',
      companyName: 'Test Company',
      googleId: 'google123',
      save: jest.fn().mockResolvedValue({}),
    };

    User.findOne.mockResolvedValueOnce(existingUser);

    await googleAuth(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'newuser@example.com' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      token: 'dummy_jwt_token',
      companyName: 'Test Company',
      role: 'ADMIN',
      employeeId: undefined,
      message: 'Logged in successfully',
    });
  });

  test('should authenticate successfully using accessToken with valid audience', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    req.body = {
      accessToken: 'dummy_access_token',
      companyName: 'Test Company',
    };

    axios.get
      .mockResolvedValueOnce({ data: { aud: 'test-client-id' } })
      .mockResolvedValueOnce({
        data: {
          sub: 'google456',
          email: 'tokenuser@example.com',
          name: 'Token User',
          picture: 'avatar2.png',
        },
      });

    User.findOne.mockResolvedValueOnce(null);

    await googleAuth(req, res);

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('oauth2.googleapis.com/tokeninfo'),
    );
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('googleapis.com/oauth2/v3/userinfo'),
    );
    expect(User.findOne).toHaveBeenCalledWith({
      email: 'tokenuser@example.com',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    delete process.env.GOOGLE_CLIENT_ID;
  });

  test('should reject accessToken with mismatched audience', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    req.body = { accessToken: 'dummy_access_token' };

    axios.get.mockResolvedValueOnce({ data: { aud: 'wrong-client-id' } });

    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid Google access token: audience mismatch',
    });
    delete process.env.GOOGLE_CLIENT_ID;
  });

  test('should reject request when no credentials are provided', async () => {
    req.body = {};

    await googleAuth(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No Google credentials provided',
    });
  });
});

describe('Update Password Controller tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      userId: 'user123',
      body: {
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('should update password and increment tokenVersion successfully with valid inputs', async () => {
    const mockUser = {
      _id: 'user123',
      password: 'hashed_old_password',
      tokenVersion: 0,
      save: jest.fn().mockResolvedValue({}),
    };

    User.findById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('hashed_new_password');

    await updatePassword(req, res, next);

    expect(mockUser.tokenVersion).toBe(1);
    expect(mockUser.password).toBe('hashed_new_password');
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Password updated successfully',
    });
  });

  test('should increment tokenVersion from undefined to 1', async () => {
    const mockUser = {
      _id: 'user123',
      password: 'hashed_old_password',
      // tokenVersion is undefined (not set)
      save: jest.fn().mockResolvedValue({}),
    };

    User.findById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('hashed_new_password');

    await updatePassword(req, res, next);

    expect(mockUser.tokenVersion).toBe(1);
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('should return 400 if currentPassword is missing', async () => {
    req.body = { newPassword: 'NewPass1!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Current password and new password are required',
    });
  });

  test('should return 400 if newPassword is missing', async () => {
    req.body = { currentPassword: 'OldPass1!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Current password and new password are required',
    });
  });

  test('should return 400 if newPassword is too short', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: 'Ab1!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character',
    });
  });

  test('should return 400 if newPassword lacks uppercase', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: 'lowercase1!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 400 if newPassword lacks number', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: 'NoNumber!!' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 400 if newPassword lacks special character', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: 'NoSpecial1' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('should return 400 if newPassword is a weak string', async () => {
    req.body = { currentPassword: 'OldPass1!', newPassword: '1' };

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        'Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character',
    });
  });

  test('should return 404 if user not found', async () => {
    User.findById.mockResolvedValue(null);

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  test('should return 400 if current password is incorrect', async () => {
    const mockUser = {
      _id: 'user123',
      password: 'hashed_old_password',
      tokenVersion: 0,
      save: jest.fn(),
    };

    User.findById.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(false);

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Incorrect current password',
    });
    expect(mockUser.save).not.toHaveBeenCalled();
  });

  test('should return 400 if user has no password set', async () => {
    const mockUser = {
      _id: 'user123',
      password: null,
    };

    User.findById.mockResolvedValue(mockUser);

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No password set. Please use password recovery.',
    });
  });
});

describe('Delete Account Controller tests', () => {
  let req;
  let res;
  let next;
  let mockSession;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { userId: 'user123', body: { currentPassword: 'correctPassword' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    bcrypt.compare.mockResolvedValue(true);
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should require current password', async () => {
    req.body = {};
    User.findById.mockResolvedValue({
      _id: 'user123',
      password: 'hashedPassword',
    });

    await deleteAccount(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Current password is required',
    });
  });

  test('should reject incorrect current password', async () => {
    bcrypt.compare.mockResolvedValue(false);
    User.findById.mockResolvedValue({
      _id: 'user123',
      password: 'hashedPassword',
    });

    await deleteAccount(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Current password is incorrect',
    });
  });

  test('should reject if user has no password set', async () => {
    User.findById.mockResolvedValue({ _id: 'user123', password: null });

    await deleteAccount(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No password set on this account',
    });
  });

  test('should delete account atomically within a transaction', async () => {
    User.findById.mockResolvedValue({
      _id: 'user123',
      password: 'hashedPassword',
    });
    Employee.deleteMany.mockResolvedValue({});
    PayrollUpdate.deleteMany.mockResolvedValue({});
    AuditLog.deleteMany.mockResolvedValue({});
    User.findByIdAndDelete.mockResolvedValue({});

    await deleteAccount(req, res, next);

    expect(mongoose.startSession).toHaveBeenCalled();
    expect(mockSession.startTransaction).toHaveBeenCalled();
    expect(mockSession.commitTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Account and associated data deleted successfully.',
    });
  });

  test('should return 404 if user not found', async () => {
    User.findById.mockResolvedValue(null);

    await deleteAccount(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('should abort transaction and call next(error) on failure', async () => {
    const error = new Error('Database failure');
    User.findById.mockResolvedValue({
      _id: 'user123',
      password: 'hashedPassword',
    });
    Employee.deleteMany.mockImplementation(() => {
      throw error;
    });

    await deleteAccount(req, res, next);

    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should fall back to non-transactional delete when transactions are not supported', async () => {
    jest
      .spyOn(mongoose, 'startSession')
      .mockRejectedValue(new Error('Transactions not supported'));

    User.findById.mockResolvedValue({
      _id: 'user123',
      password: 'hashedPassword',
    });
    Employee.deleteMany.mockResolvedValue({ deletedCount: 3 });
    PayrollUpdate.deleteMany.mockResolvedValue({ deletedCount: 5 });
    AuditLog.deleteMany.mockResolvedValue({ deletedCount: 1 });
    User.findByIdAndDelete.mockResolvedValue({ deletedCount: 1 });

    await deleteAccount(req, res, next);

    expect(Employee.deleteMany).toHaveBeenCalledWith(
      { createdBy: 'user123' },
      {},
    );
    expect(PayrollUpdate.deleteMany).toHaveBeenCalledWith(
      { createdBy: 'user123' },
      {},
    );
    expect(AuditLog.deleteMany).toHaveBeenCalledWith({ userId: 'user123' }, {});
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('user123', {});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Account and associated data deleted successfully.',
    });
  });
});
