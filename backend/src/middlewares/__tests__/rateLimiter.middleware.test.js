/**
 * The rate limiter module (#793).
 *
 * The previous version of this file asserted only that three names were
 * `defined`, which is the one thing a rename breaks loudest and the one thing
 * that test could not catch — it imported the old names, so when #685 renamed
 * them the suite failed to *load* rather than failing an assertion, and
 * "cannot find module" reads like an environment problem.
 *
 * So this suite checks the properties that actually matter: the module can be
 * required with no Redis, every name its callers import is exported and is
 * usable as express middleware, the thresholds are the ones #287/#540 settled
 * on, and the limiters actually limit.
 */

const express = require('express');
const request = require('supertest');

/** Load the module fresh, with a given environment and cache-service shape. */
function loadModule({ env = {}, redis = null } = {}) {
  let mod;

  jest.isolateModules(() => {
    jest.doMock('../../services/cache.service', () => ({
      isRedisEnabled: Boolean(redis),
      client: redis,
    }));

    const original = {};
    for (const [key, value] of Object.entries(env)) {
      original[key] = process.env[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    try {
      mod = require('../rateLimiter.middleware');
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  return mod;
}

/** A one-route app behind the given limiter. */
function appWith(limiter, { userId } = {}) {
  const app = express();
  app.set('trust proxy', 1);

  if (userId) {
    app.use((req, _res, next) => {
      req.userId = userId;
      next();
    });
  }

  app.use(limiter);
  app.get('/', (_req, res) => res.status(200).json({ ok: true }));

  return app;
}

describe('rateLimiter.middleware exports (#793)', () => {
  const limiterNames = [
    'authRateLimiter',
    'generalRateLimiter',
    'writeRateLimiter',
    'standardLimiter',
    'strictLimiter',
  ];

  it('can be required with no Redis configured', () => {
    // The #685 version threw `RedisStore is not a constructor` here, before any
    // of the assertions below could run.
    expect(() => loadModule()).not.toThrow();
  });

  it.each(limiterNames)('exports %s as express middleware', (name) => {
    const mod = loadModule();

    expect(typeof mod[name]).toBe('function');
    // express middleware is (req, res, next); the limiters express-rate-limit
    // returns declare all three.
    expect(mod[name].length).toBeGreaterThanOrEqual(3);
  });

  it('exports the names app.js and the routers actually import', () => {
    // The concrete regression: app.js destructures generalRateLimiter, and
    // user.routes.js destructures authRateLimiter. Both were undefined.
    const mod = loadModule();

    expect(mod.generalRateLimiter).toBeDefined();
    expect(mod.authRateLimiter).toBeDefined();
    expect(mod.writeRateLimiter).toBeDefined();
  });

  it('keeps #685 names pointing at the same limiters', () => {
    const mod = loadModule();

    expect(mod.standardLimiter).toBe(mod.generalRateLimiter);
    expect(mod.strictLimiter).toBe(mod.authRateLimiter);
  });

  it('survives being mounted by app.use and router.post', () => {
    // `app.use(path, undefined)` and `router.post(path, undefined, handler)`
    // are what actually threw at boot.
    const mod = loadModule();
    const app = express();
    const router = express.Router();

    expect(() => app.use('/api', mod.generalRateLimiter)).not.toThrow();
    expect(() =>
      router.post('/login', mod.authRateLimiter, (_req, res) => res.end()),
    ).not.toThrow();
  });
});

describe('the store (#793)', () => {
  it('uses the in-memory store when Redis is not configured', () => {
    expect(loadModule().isUsingRedisStore()).toBe(false);
  });

  it('uses Redis when the cache service has a client', () => {
    // `call` answers the SCRIPT LOAD the store issues on init with a plausible
    // sha, so the assertion is about which store was chosen rather than about
    // a fake client's replies.
    const client = { call: jest.fn().mockResolvedValue('a'.repeat(40)) };

    expect(loadModule({ redis: client }).isUsingRedisStore()).toBe(true);
  });

  it('still limits when the Redis store cannot be built', () => {
    // A store that blows up on construction must degrade to per-instance
    // counting, not take the process down on the way up.
    jest.isolateModules(() => {
      jest.doMock('../../services/cache.service', () => ({
        isRedisEnabled: true,
        client: { call: jest.fn() },
      }));
      jest.doMock('rate-limit-redis', () => ({
        RedisStore: function Broken() {
          throw new Error('boom');
        },
      }));

      const mod = require('../rateLimiter.middleware');

      expect(mod.isUsingRedisStore()).toBe(false);
      expect(typeof mod.generalRateLimiter).toBe('function');
    });
  });
});

describe('thresholds (#287, #540)', () => {
  /** Drive a limiter until it answers 429, and report how many got through. */
  async function countAllowed(limiter, ceiling) {
    const app = appWith(limiter);
    let allowed = 0;

    for (let i = 0; i < ceiling + 1; i += 1) {
      const res = await request(app).get('/');
      if (res.status === 429) break;
      allowed += 1;
    }

    return allowed;
  }

  it('lets a payroll-sized burst of writes through', async () => {
    // #685 dropped this to 10 a minute. Finalizing payroll for a 40-person
    // company is a few hundred write calls in a couple of minutes, so the
    // limiter was rejecting a legitimate, common operation halfway through.
    const { writeRateLimiter } = loadModule({
      env: { WRITE_RATE_LIMIT: '50' },
    });

    expect(await countAllowed(writeRateLimiter, 50)).toBe(50);
  });

  it('defaults well above the ten-per-minute #685 fell back to', async () => {
    // Asserted through behaviour rather than by reading a private field. #685's
    // default refused the 11th write in any 60 seconds; nothing here may.
    const { writeRateLimiter } = loadModule({
      env: { WRITE_RATE_LIMIT: undefined },
    });
    const app = appWith(writeRateLimiter);

    for (let i = 0; i < 12; i += 1) {
      await request(app).get('/').expect(200);
    }
  });

  it('rejects once the limit is reached', async () => {
    const { generalRateLimiter } = loadModule({
      env: { GENERAL_RATE_LIMIT: '3' },
    });
    const app = appWith(generalRateLimiter);

    for (let i = 0; i < 3; i += 1) {
      await request(app).get('/').expect(200);
    }

    const res = await request(app).get('/');

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/too many requests/i);
  });

  it('sends the standard headers and not the legacy ones', async () => {
    const { generalRateLimiter } = loadModule({
      env: { GENERAL_RATE_LIMIT: '5' },
    });

    const res = await request(appWith(generalRateLimiter)).get('/');

    expect(
      res.headers['ratelimit-limit'] || res.headers.ratelimit,
    ).toBeDefined();
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('ignores an unusable env value instead of rejecting everything', async () => {
    // `WRITE_RATE_LIMIT=` in a .env parses to NaN, and a NaN limit refuses
    // every request. Falling back is the only safe reading of a typo.
    const { writeRateLimiter } = loadModule({ env: { WRITE_RATE_LIMIT: '' } });

    await request(appWith(writeRateLimiter)).get('/').expect(200);
  });
});

describe('write limiter keying (#685)', () => {
  it('counts per user, so two users do not share a budget', async () => {
    const { writeRateLimiter } = loadModule({ env: { WRITE_RATE_LIMIT: '2' } });

    const alice = appWith(writeRateLimiter, { userId: 'alice' });
    const bob = appWith(writeRateLimiter, { userId: 'bob' });

    await request(alice).get('/').expect(200);
    await request(alice).get('/').expect(200);
    await request(alice).get('/').expect(429);

    // Bob shares Alice's IP — the office-NAT case #685 set out to fix — and
    // must still have his full allowance.
    await request(bob).get('/').expect(200);
  });

  it('falls back to the IP for an anonymous caller', async () => {
    const { writeRateLimiter } = loadModule({ env: { WRITE_RATE_LIMIT: '1' } });
    const app = appWith(writeRateLimiter);

    await request(app).get('/').expect(200);
    await request(app).get('/').expect(429);
  });

  it('buckets IPv6 callers by prefix rather than by address', async () => {
    // Without `ipKeyGenerator`, every address in a client's /64 counts as a
    // separate caller — which is to say, no limit at all for anyone on IPv6.
    const { writeRateLimiter } = loadModule({ env: { WRITE_RATE_LIMIT: '1' } });
    const app = appWith(writeRateLimiter);

    await request(app)
      .get('/')
      .set('X-Forwarded-For', '2001:db8::1')
      .expect(200);

    const res = await request(app)
      .get('/')
      .set('X-Forwarded-For', '2001:db8::2');

    expect(res.status).toBe(429);
  });
});
