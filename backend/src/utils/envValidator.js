/**
 * Startup environment variable validation to prevent hardcoded fallbacks
 * and running without critical secrets/URIs.
 */

'use strict';

const logger = require('./logger');

/**
 * Validate that critical environment variables are set.
 * Throws an error and exits the process if any required variables are missing.
 */
function validateEnv() {
  const requiredVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGO_URI'];

  const missing = [];
  for (const name of requiredVars) {
    if (!process.env[name] || process.env[name].trim() === '') {
      missing.push(name);
    }
  }

  // Refuse hardcoded fallbacks from docker-compose.yml or dev defaults in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'dev_jwt_secret_change_me') {
      logger.error(
        'CRITICAL: JWT_SECRET is set to the unsafe development default in production!',
      );
      missing.push('JWT_SECRET (unsafe value)');
    }
    if (process.env.JWT_REFRESH_SECRET === 'dev_jwt_refresh_secret_change_me') {
      logger.error(
        'CRITICAL: JWT_REFRESH_SECRET is set to the unsafe development default in production!',
      );
      missing.push('JWT_REFRESH_SECRET (unsafe value)');
    }
  }

  if (missing.length > 0) {
    logger.error(
      'FATAL STARTUP ERROR: Critical environment variables are missing or misconfigured!',
      {
        missing,
      },
    );
    // Print a user-friendly console message too
    console.error(
      `\n=======================================================\n` +
        `[FATAL STARTUP ERROR] Missing critical environment variables:\n` +
        missing.map((v) => `  - ${v}`).join('\n') +
        `\n=======================================================\n`,
    );
    process.exit(1);
  }
}

module.exports = { validateEnv };
