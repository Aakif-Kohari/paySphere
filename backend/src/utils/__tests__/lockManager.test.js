const { acquireLock, releaseLock } = require('../lockManager');
const CronLock = require('../../models/cronlock.model');

// Mock CronLock model
jest.mock('../../models/cronlock.model', () => {
  const mockCreate = jest.fn();
  const mockFindById = jest.fn();
  const mockFindByIdAndUpdate = jest.fn();
  const mockDeleteOne = jest.fn();

  return {
    create: mockCreate,
    findById: mockFindById,
    findByIdAndUpdate: mockFindByIdAndUpdate,
    deleteOne: mockDeleteOne,
  };
});

// Mock cacheService redisClient
jest.mock('../../services/cache.service', () => {
  const mockSet = jest.fn();
  const mockDel = jest.fn();
  return {
    redisClient: {
      isOpen: false, // Default: Redis unavailable
      set: mockSet,
      del: mockDel,
    },
  };
});

// Mock logger
jest.mock('../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('LockManager Mutex Utility (#1091)', () => {
  const cacheService = require('../../services/cache.service');

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.redisClient.isOpen = false;
  });

  test('should acquire lock via MongoDB when Redis is closed', async () => {
    CronLock.create.mockResolvedValueOnce({});

    const acquired = await acquireLock('mylock', 5000);

    expect(acquired).toBe(true);
    expect(CronLock.create).toHaveBeenCalledWith({
      _id: 'mylock',
      lockedAt: expect.any(Date),
      expiresAt: expect.any(Date),
    });
  });

  test('should return false on MongoDB duplicate key error (already locked)', async () => {
    const duplicateKeyError = new Error('Duplicate Key Error');
    duplicateKeyError.code = 11000;
    CronLock.create.mockRejectedValueOnce(duplicateKeyError);
    CronLock.findById.mockResolvedValueOnce({ expiresAt: new Date(Date.now() + 10000) }); // Active lock

    const acquired = await acquireLock('mylock', 5000);

    expect(acquired).toBe(false);
  });

  test('should acquire lock via Redis when Redis is open and OK', async () => {
    cacheService.redisClient.isOpen = true;
    cacheService.redisClient.set.mockResolvedValueOnce('OK');

    const acquired = await acquireLock('mylock', 5000);

    expect(acquired).toBe(true);
    expect(cacheService.redisClient.set).toHaveBeenCalledWith('mylock', '1', {
      NX: true,
      PX: 5000,
    });
    expect(CronLock.create).not.toHaveBeenCalled();
  });
});
