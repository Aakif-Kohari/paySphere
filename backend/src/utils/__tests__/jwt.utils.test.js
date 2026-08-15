/**
 * `utils/jwt.utils` — token minting and verification (#725, converted in #1008).
 *
 * This module had no tests, which is part of how it sat in the tree as an
 * unloadable `.ts` file without anyone noticing: nothing imported it and
 * nothing exercised it, so there was no signal at all. These cover the
 * behaviour the auth controller depends on, plus the two things the conversion
 * deliberately changed — secrets read at call time rather than at import, and a
 * refresh expiry derived from the same constant as the advertised lifetime.
 */

const jwt = require('jsonwebtoken');

const jwtUtils = require('../jwt.utils');

const {
  ISSUER,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_TTL_MS,
  generateAccessToken,
  generateRefreshTokenString,
  verifyAccessToken,
  getRefreshTokenExpiry,
  getAccessTokenSecret,
} = jwtUtils;

describe('utils/jwt.utils', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('generateAccessToken', () => {
    it('produces a token that verifies with the configured secret', () => {
      const token = generateAccessToken({ id: 'user-1' });
      const decoded = jwt.verify(token, 'test-access-secret');

      expect(decoded.id).toBe('user-1');
    });

    it('carries the claims the auth middleware reads back', () => {
      // `auth.middleware` reads `id`, `tenantId` and `tokenVersion` off the
      // decoded token. If any of them stopped surviving the round trip, every
      // session would silently lose its tenant scope or its revocation check.
      const token = generateAccessToken({
        id: 'user-1',
        tenantId: 'tenant-9',
        tokenVersion: 3,
        role: 'admin',
      });

      const decoded = verifyAccessToken(token);

      expect(decoded.id).toBe('user-1');
      expect(decoded.tenantId).toBe('tenant-9');
      expect(decoded.tokenVersion).toBe(3);
      expect(decoded.role).toBe('admin');
    });

    it('stamps the issuer', () => {
      const decoded = jwt.decode(generateAccessToken({ id: 'user-1' }));

      expect(decoded.iss).toBe(ISSUER);
    });

    it('expires', () => {
      const decoded = jwt.decode(generateAccessToken({ id: 'user-1' }));

      // 15 minutes. Asserted as a relationship rather than a magic number so
      // changing ACCESS_TOKEN_EXPIRY does not require editing an unrelated
      // literal here.
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
      expect(ACCESS_TOKEN_EXPIRY).toBe('15m');
      expect(decoded.exp - decoded.iat).toBe(15 * 60);
    });
  });

  describe('verifyAccessToken', () => {
    it('rejects a token signed with a different secret', () => {
      const foreign = jwt.sign({ id: 'user-1' }, 'someone-elses-secret', {
        issuer: ISSUER,
      });

      expect(() => verifyAccessToken(foreign)).toThrow();
    });

    it('rejects a token from another issuer', () => {
      // The issuer check is what stops a token minted by a different service
      // that happens to share the secret — a staging environment, a sibling
      // app — from being accepted here.
      const foreign = jwt.sign({ id: 'user-1' }, 'test-access-secret', {
        issuer: 'not-paysphere',
      });

      expect(() => verifyAccessToken(foreign)).toThrow();
    });

    it('rejects an expired token', () => {
      const expired = jwt.sign({ id: 'user-1' }, 'test-access-secret', {
        issuer: ISSUER,
        expiresIn: '-1s',
      });

      expect(() => verifyAccessToken(expired)).toThrow();
    });

    it('rejects a tampered payload', () => {
      const token = generateAccessToken({ id: 'user-1', role: 'employee' });
      const [header, , signature] = token.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ id: 'user-1', role: 'admin' }),
      ).toString('base64url');

      expect(() =>
        verifyAccessToken(`${header}.${forgedPayload}.${signature}`),
      ).toThrow();
    });
  });

  describe('generateRefreshTokenString', () => {
    it('returns 64 bytes as hex', () => {
      const token = generateRefreshTokenString();

      expect(token).toHaveLength(128);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('does not repeat', () => {
      const tokens = new Set(
        Array.from({ length: 100 }, () => generateRefreshTokenString()),
      );

      expect(tokens.size).toBe(100);
    });

    it('is opaque rather than a JWT', () => {
      // Deliberate: a refresh token is checked against the RefreshToken
      // collection on every use, so it has to be revocable. A signed,
      // self-describing token stays valid until it expires no matter what the
      // database says.
      expect(generateRefreshTokenString().split('.')).toHaveLength(1);
      expect(() => jwt.decode(generateRefreshTokenString())).not.toThrow();
      expect(jwt.decode(generateRefreshTokenString())).toBeNull();
    });
  });

  describe('getRefreshTokenExpiry', () => {
    it('is seven days out', () => {
      const now = new Date('2026-03-01T00:00:00.000Z');

      expect(getRefreshTokenExpiry(now).toISOString()).toBe(
        '2026-03-08T00:00:00.000Z',
      );
    });

    it('derives from the same constant as the advertised lifetime', () => {
      // The `.ts` version wrote `7 * 24 * 60 * 60 * 1000` inline, a second
      // source of truth next to REFRESH_TOKEN_EXPIRY = '7d'. Editing one and
      // not the other would leave stored expiries disagreeing with the value
      // handed to clients.
      const now = new Date('2026-03-01T00:00:00.000Z');

      expect(getRefreshTokenExpiry(now).getTime() - now.getTime()).toBe(
        REFRESH_TOKEN_TTL_MS,
      );
    });

    it('defaults to now', () => {
      const before = Date.now();
      const expiry = getRefreshTokenExpiry().getTime();

      expect(expiry).toBeGreaterThanOrEqual(before + REFRESH_TOKEN_TTL_MS);
    });
  });

  describe('secret resolution', () => {
    it('reads the environment at call time, not at import', () => {
      // The `.ts` version bound the secret to a module-level const, so the
      // value was frozen at first require — before dotenv had run, in some
      // orderings — and every token was signed with the built-in default.
      process.env.JWT_SECRET = 'rotated-secret';

      expect(getAccessTokenSecret()).toBe('rotated-secret');

      const token = generateAccessToken({ id: 'user-1' });
      expect(jwt.verify(token, 'rotated-secret').id).toBe('user-1');
    });

    it('falls back to a default outside production', () => {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'development';

      expect(getAccessTokenSecret()).toBe('default_access_secret');
    });

    it('refuses to sign with the default in production', () => {
      // Signing sessions with a secret that is public in the source tree is
      // the same as not signing them at all. Failing loudly at boot is better
      // than serving forgeable tokens.
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';

      expect(() => getAccessTokenSecret()).toThrow(/JWT_SECRET must be set/);
    });

    it('refuses to use the default refresh secret in production too', () => {
      delete process.env.JWT_REFRESH_SECRET;
      process.env.NODE_ENV = 'production';

      expect(() => jwtUtils.getRefreshTokenSecret()).toThrow(
        /JWT_REFRESH_SECRET must be set/,
      );
    });
  });
});
