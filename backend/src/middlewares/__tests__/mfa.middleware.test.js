const { setupMFA, verifyMFASetup, requireMFA, generateBase32Secret, verifyTOTP, decodeBase32, generateHOTP } = require('../mfa.middleware');
const User = require('../../models/user.model');

// Mock User model
jest.mock('../../models/user.model', () => {
  const mockFindById = jest.fn();
  return {
    findById: mockFindById,
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('MFA & TOTP Middleware (#1211)', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      userId: 'user123',
      headers: {},
      body: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('generateBase32Secret should return 16-character base32 secret', () => {
    const secret = generateBase32Secret(16);
    expect(secret).toHaveLength(16);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  test('TOTP verification should work for valid current token and fail for invalid', () => {
    const secret = 'JBSWY3DPEHPK3PXP'; // "Hello!" in base32
    const secretBuffer = decodeBase32(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const validToken = generateHOTP(secretBuffer, counter);

    expect(verifyTOTP(validToken, secret)).toBe(true);
    expect(verifyTOTP('000000', secret)).toBe(false);
  });

  test('setupMFA should generate a secret and return otpauthUrl', async () => {
    const mockUser = {
      _id: 'user123',
      email: 'admin@paysphere.com',
      mfaPendingSecret: null,
      save: jest.fn().mockResolvedValue({}),
    };
    User.findById.mockResolvedValueOnce(mockUser);

    await setupMFA(req, res, next);

    expect(User.findById).toHaveBeenCalledWith('user123');
    expect(mockUser.mfaPendingSecret).toBeDefined();
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);

    const jsonResponse = res.json.mock.calls[0][0];
    expect(jsonResponse.success).toBe(true);
    expect(jsonResponse.secret).toBe(mockUser.mfaPendingSecret);
    expect(jsonResponse.otpauthUrl).toContain('otpauth://totp/PaySphere');
  });

  test('verifyMFASetup should enable MFA on valid token', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const secretBuffer = decodeBase32(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const validToken = generateHOTP(secretBuffer, counter);

    const mockUser = {
      _id: 'user123',
      mfaPendingSecret: secret,
      mfaSecret: null,
      isMfaEnabled: false,
      save: jest.fn().mockResolvedValue({}),
    };
    User.findById.mockResolvedValueOnce(mockUser);

    req.body.token = validToken;

    await verifyMFASetup(req, res, next);

    expect(mockUser.isMfaEnabled).toBe(true);
    expect(mockUser.mfaSecret).toBe(secret);
    expect(mockUser.mfaPendingSecret).toBeNull();
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('verifyMFASetup should reject invalid token', async () => {
    const mockUser = {
      _id: 'user123',
      mfaPendingSecret: 'JBSWY3DPEHPK3PXP',
      save: jest.fn(),
    };
    User.findById.mockResolvedValueOnce(mockUser);

    req.body.token = '000000'; // Invalid

    await verifyMFASetup(req, res, next);

    expect(mockUser.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('requireMFA should pass through if MFA is disabled for user', async () => {
    const mockUser = {
      _id: 'user123',
      isMfaEnabled: false,
    };
    User.findById.mockResolvedValueOnce(mockUser);

    await requireMFA(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('requireMFA should block if MFA is enabled and token is missing', async () => {
    const mockUser = {
      _id: 'user123',
      isMfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP',
    };
    User.findById.mockResolvedValueOnce(mockUser);

    await requireMFA(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
