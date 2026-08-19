const { integrationSecurity, ipInCidr, checkRateLimit, memoryRateLimits } = require('../integrationSecurity');
const IntegrationConfig = require('../../models/integrationConfig.model');
const { decrypt } = require('../../services/encryption.service');
const { redisClient } = require('../../services/cache.service');
const crypto = require('crypto');

// Mock models and services
jest.mock('../../models/integrationConfig.model', () => {
  const mockFindOne = jest.fn();
  return {
    findOne: mockFindOne,
  };
});

jest.mock('../../services/encryption.service', () => ({
  decrypt: jest.fn().mockImplementation((val) => val), // Identity function for mock decryption
}));

jest.mock('../../services/cache.service', () => {
  const mockSet = jest.fn();
  const mockDel = jest.fn();
  return {
    redisClient: {
      isOpen: false, // Default: Redis unavailable
      multi: jest.fn().mockReturnValue({
        zRemRangeByScore: jest.fn().mockReturnThis(),
        zAdd: jest.fn().mockReturnThis(),
        zCard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([null, null, 1]), // zcard is 1 by default
      }),
    },
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Integration Security Middleware (#1214)', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    memoryRateLimits.clear();
    req = {
      headers: {
        'x-tenant-id': 'tenant123',
      },
      params: {
        provider: 'bamboohr',
      },
      body: { employees: [] },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('ipInCidr should match IPv4 CIDR and static ranges correctly', () => {
    expect(ipInCidr('127.0.0.1', '127.0.0.1')).toBe(true);
    expect(ipInCidr('127.0.0.1', '127.0.0.0/24')).toBe(true);
    expect(ipInCidr('192.168.1.50', '192.168.1.0/24')).toBe(true);
    expect(ipInCidr('192.168.2.50', '192.168.1.0/24')).toBe(false);
  });

  test('should reject request if tenantId or provider is missing', async () => {
    req.headers['x-tenant-id'] = '';
    await integrationSecurity(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('Missing tenant') });
  });

  test('should reject request if config is not found', async () => {
    IntegrationConfig.findOne.mockResolvedValueOnce(null);
    await integrationSecurity(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('not found') });
  });

  test('should reject request if config is inactive', async () => {
    IntegrationConfig.findOne.mockResolvedValueOnce({ isActive: false });
    await integrationSecurity(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('inactive') });
  });

  test('should reject request from disallowed IP ranges', async () => {
    IntegrationConfig.findOne.mockResolvedValueOnce({
      isActive: true,
      allowedIpRanges: ['192.168.10.0/24'],
      credentials: {},
    });

    await integrationSecurity(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('IP address not allowed') });
  });

  test('should reject request if signature is missing', async () => {
    IntegrationConfig.findOne.mockResolvedValueOnce({
      isActive: true,
      allowedIpRanges: ['127.0.0.1'],
      credentials: { clientSecret: 'supersecret' },
    });

    await integrationSecurity(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('Signature missing') });
  });

  test('should reject request if signature is invalid', async () => {
    IntegrationConfig.findOne.mockResolvedValueOnce({
      isActive: true,
      allowedIpRanges: ['127.0.0.1'],
      credentials: { clientSecret: 'supersecret' },
    });
    req.headers['x-integration-signature'] = 'wrongsignature';

    await integrationSecurity(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('Invalid signature') });
  });

  test('should allow request with valid signature, whitelisted IP, and within rate limits', async () => {
    IntegrationConfig.findOne.mockResolvedValueOnce({
      isActive: true,
      allowedIpRanges: ['127.0.0.1'],
      credentials: { clientSecret: 'supersecret' },
    });

    const bodyStr = JSON.stringify(req.body);
    const validSignature = crypto.createHmac('sha256', 'supersecret').update(bodyStr).digest('hex');
    req.headers['x-integration-signature'] = validSignature;

    await integrationSecurity(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantId).toBe('tenant123');
    expect(req.provider).toBe('bamboohr');
  });

  test('should enforce sliding window rate limit of 5 requests per minute', async () => {
    IntegrationConfig.findOne.mockImplementation(() => Promise.resolve({
      isActive: true,
      allowedIpRanges: ['127.0.0.1'],
      credentials: { clientSecret: 'supersecret' },
    }));

    const bodyStr = JSON.stringify(req.body);
    const validSignature = crypto.createHmac('sha256', 'supersecret').update(bodyStr).digest('hex');
    req.headers['x-integration-signature'] = validSignature;

    // Send 5 successful requests
    for (let i = 0; i < 5; i++) {
      await integrationSecurity(req, res, next);
    }
    expect(next).toHaveBeenCalledTimes(5);

    // 6th request should fail with 429
    await integrationSecurity(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ message: 'Too Many Requests' });
  });
});
