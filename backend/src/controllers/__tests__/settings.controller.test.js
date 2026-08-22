const { updateSettings, getSettings } = require('../settings.controller.ts');
const User = require('../../models/user.model');
const eventBus = require('../../services/event.service');

jest.mock('../../models/user.model', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../services/event.service', () => ({
  emitAuditLog: jest.fn(() => true),
}));

describe('settings.controller.ts (TypeScript Migration)', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { userId: 'user123', body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('getSettings', () => {
    it('returns 401 when userId is missing', async () => {
      req.userId = undefined;
      await getSettings(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns user settings on valid lookup', async () => {
      const mockUser = {
        _id: 'user123',
        fullName: 'Jane Doe',
        email: 'jane@acme.com',
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await getSettings(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: mockUser,
      });
    });
  });

  describe('updateSettings', () => {
    it('updates rates and emits audit log', async () => {
      const mockUser = {
        _id: 'user123',
        fullName: 'Jane Doe',
        email: 'jane@acme.com',
        defaultDailyRate: 0,
        defaultOvertimeRate: 0,
        settings: {},
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockResolvedValue(mockUser);
      req.body = { defaultDailyRate: 1500, defaultOvertimeRate: 200 };

      await updateSettings(req, res, next);

      expect(mockUser.defaultDailyRate).toBe(1500);
      expect(mockUser.defaultOvertimeRate).toBe(200);
      expect(mockUser.save).toHaveBeenCalled();
      expect(eventBus.emitAuditLog).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects invalid email formats', async () => {
      User.findById.mockResolvedValue({ _id: 'user123', email: 'old@acme.com' });
      req.body = { email: 'invalid-email-address' };

      await updateSettings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid email address format',
      });
    });
  });
});
