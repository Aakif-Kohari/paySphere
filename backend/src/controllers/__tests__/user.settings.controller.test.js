const { updateSettings, updatePassword } = require('../user.controller');
const User = require('../../models/user.model');
const bcrypt = require('bcryptjs');
const eventBus = require('../../services/event.service');

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('axios');
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

jest.mock('../../services/event.service', () => ({
  AUDIT_LOG_EVENT: 'AUDIT_LOG',
  emitAuditLog: jest.fn(() => true),
  emit: jest.fn(),
  on: jest.fn(),
}));

jest.mock('../../models/user.model', () => {
  const mockConstructor = jest.fn();
  mockConstructor.findOne = jest.fn();
  mockConstructor.findById = jest.fn();
  mockConstructor.findByIdAndDelete = jest.fn();
  mockConstructor.findByIdAndUpdate = jest.fn();
  return mockConstructor;
});

jest.mock('../../models/employee.model', () => ({
  deleteMany: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../models/payroll.model', () => ({
  deleteMany: jest.fn(),
}));

/** Build a mongoose-ish user document with a spy-able save(). */
const buildUser = (overrides = {}) => ({
  _id: 'user123',
  fullName: 'Original Name',
  email: 'owner@acme.com',
  companyName: 'Acme Ltd',
  password: 'hashed_current_password',
  defaultOvertimeRate: 0,
  defaultDailyRate: 0,
  tokenVersion: 0,
  settings: {
    preferences: { language: 'English', theme: 'system' },
    companyInfo: { payrollCycle: 'monthly' },
    payrollConfig: { currency: 'INR', leaveDeductionPolicy: 'basic_only' },
    notifications: {
      emailReminders: true,
      systemAlerts: true,
      payrollCompletion: true,
    },
  },
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe('updateSettings — regression coverage for #411', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { userId: 'user123', body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
    next = jest.fn();
  });

  describe('the #411 regression itself', () => {
    test('responds 200 after a successful save instead of throwing ReferenceError', async () => {
      // Before the fix, `eventBus` was never imported into user.controller.js.
      // The emit sits *after* `await user.save()`, so the settings were written
      // and the request then died with a ReferenceError -> 500. The user saw a
      // failure for a change that had already been persisted.
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = { fullName: 'Updated Name' };

      await updateSettings(req, res, next);

      expect(user.save).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('emits exactly one SETTINGS_UPDATE audit event', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = { fullName: 'Updated Name', companyName: 'New Co' };

      await updateSettings(req, res, next);

      expect(eventBus.emitAuditLog).toHaveBeenCalledTimes(1);
      expect(eventBus.emitAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          action: 'SETTINGS_UPDATE',
          resourceType: 'User',
          details: { updatedFields: ['fullName', 'companyName'] },
        }),
      );
    });

    test('still responds 200 when the audit layer fails', async () => {
      // Audit logging is fire-and-forget. A fault there must never turn a
      // committed write into a 500.
      eventBus.emitAuditLog.mockReturnValueOnce(false);
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = { fullName: 'Updated Name' };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    test('returns the updated profile in the response body', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = { fullName: 'Updated Name', defaultDailyRate: 500 };

      await updateSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Settings updated successfully',
          fullName: 'Updated Name',
          email: 'owner@acme.com',
          companyName: 'Acme Ltd',
          defaultDailyRate: 500,
        }),
      );
    });
  });

  describe('request body guard', () => {
    test('returns 400 when the body is missing', async () => {
      req.body = undefined;

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Request body is required',
      });
      expect(User.findById).not.toHaveBeenCalled();
    });

    test('returns 400 when the body is not an object', async () => {
      req.body = 'not-an-object';

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('user lookup', () => {
    test('returns 404 when the user no longer exists', async () => {
      User.findById.mockResolvedValue(null);
      req.body = { fullName: 'Whoever' };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    test('forwards a database error to next()', async () => {
      const dbError = new Error('DB connection failed');
      User.findById.mockRejectedValue(dbError);
      req.body = { fullName: 'Whoever' };

      await updateSettings(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('default rate validation', () => {
    test('rejects a negative defaultOvertimeRate', async () => {
      User.findById.mockResolvedValue(buildUser());
      req.body = { defaultOvertimeRate: -1 };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Default rates must be non-negative numbers',
      });
    });

    test('rejects a non-numeric defaultDailyRate', async () => {
      User.findById.mockResolvedValue(buildUser());
      req.body = { defaultDailyRate: '500' };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects NaN', async () => {
      User.findById.mockResolvedValue(buildUser());
      req.body = { defaultDailyRate: NaN };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects an overtime rate above OVERTIME_RATE_MAX', async () => {
      User.findById.mockResolvedValue(buildUser());
      req.body = { defaultOvertimeRate: 1000001 };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Default overtime rate cannot exceed 1000000',
      });
    });

    test('rejects a daily rate above DAILY_RATE_MAX', async () => {
      User.findById.mockResolvedValue(buildUser());
      req.body = { defaultDailyRate: 10000001 };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Default daily rate cannot exceed 10000000',
      });
    });

    test('accepts zero as a valid rate', async () => {
      const user = buildUser({ defaultDailyRate: 900 });
      User.findById.mockResolvedValue(user);
      req.body = { defaultDailyRate: 0 };

      await updateSettings(req, res, next);

      expect(user.defaultDailyRate).toBe(0);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('falls back to settings.payrollConfig for the daily rate (#380)', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = { settings: { payrollConfig: { defaultDailyRate: 750 } } };

      await updateSettings(req, res, next);

      expect(user.defaultDailyRate).toBe(750);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('falls back to settings.payrollConfig for the overtime rate (#380)', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = { settings: { payrollConfig: { defaultOvertimeRate: 120 } } };

      await updateSettings(req, res, next);

      expect(user.defaultOvertimeRate).toBe(120);
    });

    test('a top-level rate takes precedence over the payrollConfig fallback', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = {
        defaultDailyRate: 100,
        settings: { payrollConfig: { defaultDailyRate: 999 } },
      };

      await updateSettings(req, res, next);

      expect(user.defaultDailyRate).toBe(100);
    });
  });

  describe('email handling', () => {
    test('rejects a malformed email', async () => {
      User.findById.mockResolvedValue(buildUser());
      req.body = { email: 'not-an-email' };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid email address format',
      });
    });

    test('returns 409 when the email belongs to another account', async () => {
      User.findById.mockResolvedValue(buildUser());
      User.findOne.mockResolvedValue({ _id: 'someone-else' });
      req.body = { email: 'taken@acme.com' };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email is already in use by another account',
      });
    });

    test('normalizes the email to lowercase before saving', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      User.findOne.mockResolvedValue(null);
      req.body = { email: '  NewOwner@ACME.com  ' };

      await updateSettings(req, res, next);

      expect(user.email).toBe('newowner@acme.com');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('skips the uniqueness lookup when the email is unchanged', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = { email: 'owner@acme.com' };

      await updateSettings(req, res, next);

      expect(User.findOne).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('nested settings merge', () => {
    test('merges preferences without dropping untouched keys', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = { settings: { preferences: { theme: 'dark' } } };

      await updateSettings(req, res, next);

      expect(user.settings.preferences).toEqual({
        language: 'English',
        theme: 'dark',
      });
    });

    test('merges notifications without dropping untouched keys', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = { settings: { notifications: { systemAlerts: false } } };

      await updateSettings(req, res, next);

      expect(user.settings.notifications).toEqual({
        emailReminders: true,
        systemAlerts: false,
        payrollCompletion: true,
      });
    });

    test('merges companyInfo and payrollConfig independently', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = {
        settings: {
          companyInfo: { payrollCycle: 'weekly' },
          payrollConfig: { currency: 'USD' },
        },
      };

      await updateSettings(req, res, next);

      expect(user.settings.companyInfo.payrollCycle).toBe('weekly');
      expect(user.settings.payrollConfig.currency).toBe('USD');
      expect(user.settings.payrollConfig.leaveDeductionPolicy).toBe(
        'basic_only',
      );
    });

    test('sanitizes HTML out of fullName and companyName', async () => {
      const user = buildUser();
      User.findById.mockResolvedValue(user);
      req.body = {
        fullName: '<script>alert(1)</script>Mohit',
        companyName: '<b>Acme</b>',
      };

      await updateSettings(req, res, next);

      expect(user.fullName).toBe('alert(1)Mohit');
      expect(user.companyName).toBe('Acme');
    });
  });
});

describe('updatePassword — regression coverage for #411', () => {
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
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('hashed_new_password');
  });

  test('responds 200 after persisting the new password', async () => {
    // The most damaging instance of #411: the password *and* the tokenVersion
    // bump were committed, then the ReferenceError produced a 500. The user was
    // signed out of every device while being told the change had failed.
    const user = buildUser();
    User.findById.mockResolvedValue(user);

    await updatePassword(req, res, next);

    expect(user.password).toBe('hashed_new_password');
    expect(user.tokenVersion).toBe(1);
    expect(user.save).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Password updated successfully',
    });
  });

  test('emits a PASSWORD_UPDATE audit event', async () => {
    User.findById.mockResolvedValue(buildUser());

    await updatePassword(req, res, next);

    expect(eventBus.emitAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user123',
        action: 'PASSWORD_UPDATE',
        resourceType: 'User',
      }),
    );
  });

  test('still responds 200 when the audit layer fails', async () => {
    eventBus.emitAuditLog.mockReturnValueOnce(false);
    User.findById.mockResolvedValue(buildUser());

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a weak new password before touching the database', async () => {
    const user = buildUser();
    User.findById.mockResolvedValue(user);
    req.body.newPassword = 'weak';

    await updatePassword(req, res, next);

    expect(user.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(eventBus.emitAuditLog).not.toHaveBeenCalled();
  });

  test('rejects an incorrect current password', async () => {
    bcrypt.compare.mockResolvedValue(false);
    const user = buildUser();
    User.findById.mockResolvedValue(user);

    await updatePassword(req, res, next);

    expect(user.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Incorrect current password',
    });
  });

  test('returns 400 for a Google-only account with no password set', async () => {
    User.findById.mockResolvedValue(buildUser({ password: undefined }));

    await updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No password set. Please use password recovery.',
    });
  });
});
