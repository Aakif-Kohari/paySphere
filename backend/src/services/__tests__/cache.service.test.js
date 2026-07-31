const logger = require('../../utils/logger');

jest.mock(
  'ioredis',
  () => {
    return jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
    }));
  },
  { virtual: true },
);
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('CacheService (#407)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('In-Memory Mode (REDIS_URL unset)', () => {
    let cacheService;

    beforeEach(() => {
      delete process.env.REDIS_URL;
      const { CacheService } = require('../cache.service');
      cacheService = new CacheService();
    });

    test('should store and retrieve value from memory cache', async () => {
      await cacheService.setEx('key1', 60, { foo: 'bar' });
      const result = await cacheService.get('key1');
      expect(result).toEqual({ foo: 'bar' });
    });

    test('should return null for non-existent key', async () => {
      const result = await cacheService.get('nonexistent');
      expect(result).toBeNull();
    });

    test('should return null and delete expired key', async () => {
      await cacheService.setEx('keyExpired', -1, { foo: 'bar' });
      const result = await cacheService.get('keyExpired');
      expect(result).toBeNull();
    });

    test('should delete key manually', async () => {
      await cacheService.setEx('key2', 60, { foo: 'bar' });
      await cacheService.del('key2');
      const result = await cacheService.get('key2');
      expect(result).toBeNull();
    });

    test('should invalidate pattern in memory cache', async () => {
      await cacheService.setEx('analytics:user1:summary', 60, { a: 1 });
      await cacheService.setEx('analytics:user1:details', 60, { b: 2 });
      await cacheService.setEx('other:user1', 60, { c: 3 });

      await cacheService.invalidatePattern('analytics:user1');

      expect(await cacheService.get('analytics:user1:summary')).toBeNull();
      expect(await cacheService.get('analytics:user1:details')).toBeNull();
      expect(await cacheService.get('other:user1')).toEqual({ c: 3 });
    });
  });

  describe('Redis Mode (REDIS_URL set)', () => {
    let cacheService;
    let mockRedisClient;

    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { CacheService } = require('../cache.service');
      cacheService = new CacheService();

      mockRedisClient = cacheService.client;
      mockRedisClient.get = jest.fn();
      mockRedisClient.setex = jest.fn();
      mockRedisClient.del = jest.fn();
      mockRedisClient.scan = jest.fn();
    });

    test('should call redis get and parse JSON', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ test: 123 }));
      const res = await cacheService.get('myKey');
      expect(mockRedisClient.get).toHaveBeenCalledWith('myKey');
      expect(res).toEqual({ test: 123 });
    });

    test('should handle redis get error gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      const res = await cacheService.get('myKey');
      expect(res).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    test('should set value with TTL in Redis', async () => {
      await cacheService.setEx('myKey', 30, { data: 'test' });
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'myKey',
        30,
        JSON.stringify({ data: 'test' }),
      );
    });

    test('should delete key in Redis', async () => {
      await cacheService.del('myKey');
      expect(mockRedisClient.del).toHaveBeenCalledWith('myKey');
    });

    test('should invalidate pattern without RangeError on large number of keys (#407)', async () => {
      // Simulate SCAN returning 1200 keys
      const largeKeysArray = Array.from(
        { length: 1200 },
        (_, i) => `analytics:user1:key_${i}`,
      );

      mockRedisClient.scan
        .mockResolvedValueOnce(['100', largeKeysArray.slice(0, 700)])
        .mockResolvedValueOnce(['0', largeKeysArray.slice(700)]);

      await cacheService.invalidatePattern('analytics:user1');

      // Verify batching of 500 keys per del call
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        largeKeysArray.slice(0, 500),
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        largeKeysArray.slice(500, 700),
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        largeKeysArray.slice(700, 1200),
      );
    });
  });
});
