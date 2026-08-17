/**
 * Unit tests for startup environment variable validator.
 */

'use strict';

const { validateEnv } = require('../envValidator');
const logger = require('../logger');

jest.mock('../logger', () => ({
  error: jest.fn(),
}));

describe('Environment Variable Validator', () => {
  let originalEnv;
  let exitMock;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
    exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    exitMock.mockRestore();
    console.error.mockRestore();
  });

  it('should pass if all required env vars are present', () => {
    process.env.JWT_SECRET = 'supersecret';
    process.env.JWT_REFRESH_SECRET = 'anothersecret';
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';

    validateEnv();

    expect(logger.error).not.toHaveBeenCalled();
    expect(exitMock).not.toHaveBeenCalled();
  });

  it('should fail and exit process if any critical env var is missing', () => {
    process.env.JWT_SECRET = 'supersecret';
    process.env.JWT_REFRESH_SECRET = 'anothersecret';
    delete process.env.MONGO_URI;

    validateEnv();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('FATAL STARTUP ERROR'),
      expect.objectContaining({ missing: ['MONGO_URI'] }),
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('should refuse unsafe development defaults in production mode', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev_jwt_secret_change_me';
    process.env.JWT_REFRESH_SECRET = 'dev_jwt_refresh_secret_change_me';
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';

    validateEnv();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'JWT_SECRET is set to the unsafe development default',
      ),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'JWT_REFRESH_SECRET is set to the unsafe development default',
      ),
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
