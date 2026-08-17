/**
 * Access and refresh token helpers (#725).
 *
 * This file was `jwt.utils.ts` and shared the defect described in
 * `middlewares/auth.middleware.js` (#1008): a TypeScript source in a CommonJS
 * project with no build step, unresolvable by `require` and unparseable by the
 * Babel config the test runner uses.
 *
 * It was the less visible half of the pair. Nothing currently imports it, so it
 * never took the boot down the way the auth middleware did — it simply sat
 * there as a module that would break the process the moment somebody wired it
 * in. Converting it now rather than deleting it keeps #725's intent (short
 * access tokens, opaque long-lived refresh tokens) available to the auth
 * controller, which still mints tokens inline.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Secrets are read at call time, not at module load.
 *
 * The `.ts` version bound both to module-level `const`s, which meant the value
 * was frozen at the first `require`. In tests — and in `index.js`, where
 * `dotenv.config()` runs before the app is required but after Jest has already
 * loaded modules — that captured the fallback string rather than the configured
 * secret, and every token signed afterwards used a default that the verifier on
 * a differently-ordered process would not accept.
 *
 * The fallbacks are kept so a developer without a `.env` still gets a working
 * server, but they are refused outright in production: signing sessions with a
 * secret that is public in the source tree is the same as not signing them.
 */

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ISSUER = 'paysphere-api';

const DEFAULT_ACCESS_SECRET = 'default_access_secret';
const DEFAULT_REFRESH_SECRET = 'default_refresh_secret';

/**
 * @param {string} envVar
 * @param {string} fallback
 * @returns {string}
 */
function readSecret(envVar, fallback) {
  const configured = process.env[envVar];
  if (configured) return configured;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `${envVar} must be set in production — refusing to sign tokens with the built-in default.`,
    );
  }

  return fallback;
}

/** @returns {string} */
function getAccessTokenSecret() {
  return readSecret('JWT_SECRET', DEFAULT_ACCESS_SECRET);
}

/** @returns {string} */
function getRefreshTokenSecret() {
  return readSecret('JWT_REFRESH_SECRET', DEFAULT_REFRESH_SECRET);
}

/**
 * The claims carried by an access token.
 *
 * @typedef {object} AccessTokenPayload
 * @property {string} id
 * @property {string} [tenantId]
 * @property {string} [role]
 * @property {number} [tokenVersion]
 */

/**
 * Sign a short-lived access token.
 *
 * @param {AccessTokenPayload} payload
 * @returns {string}
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, getAccessTokenSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: ISSUER,
  });
}

/**
 * A refresh token.
 *
 * Deliberately not a JWT. A refresh token is checked against
 * `RefreshToken` on every use, so it needs to be revocable, and a
 * self-describing signed token is the opposite of that — it stays valid until
 * it expires whatever the database says. 64 random bytes carry no claims, mean
 * nothing without the row they point at, and can be invalidated by deleting it.
 *
 * @returns {string} 128 hex characters
 */
function generateRefreshTokenString() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Verify an access token and return its claims.
 *
 * Throws on an expired, malformed, wrongly-signed or foreign-issuer token —
 * callers are expected to translate that into a 401 without echoing which of
 * those it was.
 *
 * @param {string} token
 * @returns {AccessTokenPayload}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, getAccessTokenSecret(), { issuer: ISSUER });
}

/**
 * When a refresh token issued now should stop working.
 *
 * Derived from the same constant as `REFRESH_TOKEN_EXPIRY` rather than a second
 * hand-written `7 * 24 * 60 * 60 * 1000`, so the stored expiry and the advertised
 * lifetime cannot drift apart.
 *
 * @param {Date} [now]
 * @returns {Date}
 */
function getRefreshTokenExpiry(now = new Date()) {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
}

module.exports = {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_TTL_MS,
  ISSUER,
  getAccessTokenSecret,
  getRefreshTokenSecret,
  generateAccessToken,
  generateRefreshTokenString,
  verifyAccessToken,
  getRefreshTokenExpiry,
};
