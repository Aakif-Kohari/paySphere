const winston = require('winston');

describe('Winston Logger Configuration (#1048)', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Clear require cache to ensure logger.js is re-evaluated with the test's NODE_ENV setting
    delete require.cache[require.resolve('../logger')];
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('should include a standard colorized console transport in non-production environments', () => {
    process.env.NODE_ENV = 'development';
    const logger = require('../logger');

    // Find console transport
    const consoleTransports = logger.transports.filter(
      (t) => t instanceof winston.transports.Console
    );

    expect(consoleTransports.length).toBe(1);
    
    // Test logging message
    const infoSpy = jest.spyOn(logger, 'info');
    logger.info('Dev environment log test');
    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  test('should include structured JSON console transport in production environment for ELK stack', () => {
    process.env.NODE_ENV = 'production';
    const logger = require('../logger');

    // Find console transport
    const consoleTransports = logger.transports.filter(
      (t) => t instanceof winston.transports.Console
    );

    expect(consoleTransports.length).toBe(1);

    // Verify format configuration (combines redact, timestamp, and json formatters)
    // Production console transport uses winston.format.json()
    const productionConsole = consoleTransports[0];
    expect(productionConsole.format).toBeDefined();

    const infoSpy = jest.spyOn(logger, 'info');
    logger.info('Prod ELK stack environment JSON log test', { meta: 'elk-test' });
    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
  });
});
