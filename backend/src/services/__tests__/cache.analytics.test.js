jest.mock(
  "ioredis",
  () =>
    jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      disconnect: jest.fn(),
    })),
  { virtual: true },
);
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

describe("CacheService.invalidateAnalytics (#415)", () => {
  const OLD_ENV = process.env;
  let cacheService;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.REDIS_URL;
    // Re-require after resetModules so this points at the same logger instance
    // the freshly-loaded cache.service closed over.
    logger = require("../../utils/logger");
    const { CacheService } = require("../cache.service");
    cacheService = new CacheService();
  });

  afterEach(() => {
    if (cacheService) cacheService.destroy();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("clears every cached range for the user", async () => {
    // getAnalytics keys on `analytics:<userId>:<monthsBack>`, so one user has an
    // entry per range they have viewed. All of them must go.
    await cacheService.setEx("analytics:user123:6", 3600, { total: 1 });
    await cacheService.setEx("analytics:user123:12", 3600, { total: 2 });
    await cacheService.setEx("analytics:user123:3", 3600, { total: 3 });

    await cacheService.invalidateAnalytics("user123");

    expect(await cacheService.get("analytics:user123:6")).toBeNull();
    expect(await cacheService.get("analytics:user123:12")).toBeNull();
    expect(await cacheService.get("analytics:user123:3")).toBeNull();
  });

  test("does not clear another user's cache", async () => {
    await cacheService.setEx("analytics:user123:6", 3600, { total: 1 });
    await cacheService.setEx("analytics:user456:6", 3600, { total: 99 });

    await cacheService.invalidateAnalytics("user123");

    expect(await cacheService.get("analytics:user456:6")).toEqual({
      total: 99,
    });
  });

  test("leaves unrelated cache entries alone", async () => {
    await cacheService.setEx("something:else", 3600, { keep: true });

    await cacheService.invalidateAnalytics("user123");

    expect(await cacheService.get("something:else")).toEqual({ keep: true });
  });

  test("returns true on success", async () => {
    await expect(cacheService.invalidateAnalytics("user123")).resolves.toBe(
      true,
    );
  });

  test("returns false and does nothing without a userId", async () => {
    await cacheService.setEx("analytics:user123:6", 3600, { total: 1 });

    await expect(cacheService.invalidateAnalytics(undefined)).resolves.toBe(
      false,
    );
    await expect(cacheService.invalidateAnalytics("")).resolves.toBe(false);
    expect(await cacheService.get("analytics:user123:6")).toEqual({ total: 1 });
  });

  test("never throws when the underlying cache fails", async () => {
    // A cache outage must not fail a payroll write.
    cacheService.invalidatePattern = jest
      .fn()
      .mockRejectedValue(new Error("Redis down"));

    await expect(cacheService.invalidateAnalytics("user123")).resolves.toBe(
      false,
    );
    expect(logger.error).toHaveBeenCalled();
  });

  test("is a no-op when nothing is cached", async () => {
    await expect(cacheService.invalidateAnalytics("user123")).resolves.toBe(
      true,
    );
  });

  test("is a no-op when nothing matches", async () => {
    await cacheService.setEx("analytics:user456:6", 3600, { total: 1 });

    await expect(cacheService.invalidateAnalytics("user123")).resolves.toBe(
      true,
    );
    expect(await cacheService.get("analytics:user456:6")).toEqual({ total: 1 });
  });
});

describe("CacheService.invalidateAnalytics in Redis mode (#415)", () => {
  const OLD_ENV = process.env;
  let cacheService;
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...OLD_ENV, REDIS_URL: "redis://localhost:6379" };

    const { CacheService } = require("../cache.service");
    cacheService = new CacheService();

    // Re-stub the client methods directly rather than relying on the module
    // factory, which is what the existing CacheService suite does.
    client = cacheService.client;
    client.del = jest.fn().mockResolvedValue(1);
    client.scan = jest.fn();
    client.disconnect = jest.fn();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("scans with the user-scoped pattern", async () => {
    client.scan.mockResolvedValueOnce(["0", ["analytics:user123:6"]]);

    await cacheService.invalidateAnalytics("user123");

    expect(client.scan).toHaveBeenCalledWith(
      "0",
      "MATCH",
      "*analytics:user123*",
      "COUNT",
      "100",
    );
  });

  test("follows the cursor until the scan completes", async () => {
    client.scan
      .mockResolvedValueOnce(["17", ["analytics:user123:6"]])
      .mockResolvedValueOnce(["0", ["analytics:user123:12"]]);

    await expect(cacheService.invalidateAnalytics("user123")).resolves.toBe(
      true,
    );

    expect(client.scan).toHaveBeenCalledTimes(2);
    expect(client.del).toHaveBeenCalledTimes(2);
  });

  test("returns true even when a Redis error is swallowed downstream", async () => {
    // invalidatePattern already logs and swallows Redis faults so the caller's
    // write is never failed by the cache.
    client.scan.mockRejectedValue(new Error("Redis down"));

    await expect(cacheService.invalidateAnalytics("user123")).resolves.toBe(
      true,
    );
  });
});
