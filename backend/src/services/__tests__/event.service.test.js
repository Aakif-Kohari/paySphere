jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

describe('event.service', () => {
  let eventBus;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Re-require *after* resetModules so this reference points at the same
    // logger instance the freshly-loaded event.service closed over.
    logger = require('../../utils/logger');
    eventBus = require('../event.service');
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('module shape', () => {
    test('exports an EventEmitter instance', () => {
      expect(typeof eventBus.on).toBe('function');
      expect(typeof eventBus.emit).toBe('function');
      expect(typeof eventBus.removeAllListeners).toBe('function');
    });

    test('exposes the AUDIT_LOG event name as a constant', () => {
      expect(eventBus.AUDIT_LOG_EVENT).toBe('AUDIT_LOG');
    });

    test('exposes the emitAuditLog helper', () => {
      expect(typeof eventBus.emitAuditLog).toBe('function');
    });

    test('keeps the legacy `eventBus.emit("AUDIT_LOG", ...)` call style working', () => {
      // employee/payroll/reports controllers still call emit() directly.
      // Attaching the helper to the instance must not break them.
      const listener = jest.fn();
      eventBus.on('AUDIT_LOG', listener);

      eventBus.emit('AUDIT_LOG', { action: 'LEGACY_STYLE' });

      expect(listener).toHaveBeenCalledWith({ action: 'LEGACY_STYLE' });
    });

    test('is a singleton across require calls', () => {
      const again = require('../event.service');
      expect(again).toBe(eventBus);
    });
  });

  describe('emitAuditLog', () => {
    test('delivers the payload to AUDIT_LOG listeners', () => {
      const listener = jest.fn();
      eventBus.on(eventBus.AUDIT_LOG_EVENT, listener);

      const payload = {
        userId: 'user123',
        action: 'SETTINGS_UPDATE',
        resourceType: 'User',
        details: { updatedFields: ['fullName'] },
      };

      eventBus.emitAuditLog(payload);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(payload);
    });

    test('returns true when the event is emitted cleanly', () => {
      eventBus.on(eventBus.AUDIT_LOG_EVENT, jest.fn());
      expect(eventBus.emitAuditLog({ action: 'OK' })).toBe(true);
    });

    test('returns true when there are no listeners at all', () => {
      // A missing listener is not an error — audit logging is optional.
      expect(eventBus.emitAuditLog({ action: 'NO_LISTENERS' })).toBe(true);
    });

    test('delivers to every registered listener', () => {
      const first = jest.fn();
      const second = jest.fn();
      eventBus.on(eventBus.AUDIT_LOG_EVENT, first);
      eventBus.on(eventBus.AUDIT_LOG_EVENT, second);

      eventBus.emitAuditLog({ action: 'FANOUT' });

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });

    test('swallows a synchronously throwing listener and returns false', () => {
      // EventEmitter.emit is synchronous, so without the try/catch this throw
      // would propagate back into the controller *after* the DB write has
      // already committed — the exact 500-on-success failure from #411.
      eventBus.on(eventBus.AUDIT_LOG_EVENT, () => {
        throw new Error('audit listener exploded');
      });

      expect(() => eventBus.emitAuditLog({ action: 'BOOM' })).not.toThrow();
      expect(eventBus.emitAuditLog({ action: 'BOOM' })).toBe(false);
    });

    test('logs the failure with enough context to debug it', () => {
      eventBus.on(eventBus.AUDIT_LOG_EVENT, () => {
        throw new Error('audit listener exploded');
      });

      eventBus.emitAuditLog({
        action: 'PASSWORD_UPDATE',
        resourceType: 'User',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to emit AUDIT_LOG event',
        expect.objectContaining({
          action: 'PASSWORD_UPDATE',
          resourceType: 'User',
          error: 'audit listener exploded',
        }),
      );
    });

    test('does not throw when called with no payload', () => {
      expect(() => eventBus.emitAuditLog()).not.toThrow();
      expect(() => eventBus.emitAuditLog(null)).not.toThrow();
    });

    test('logs undefined action/resourceType rather than throwing on a null payload', () => {
      eventBus.on(eventBus.AUDIT_LOG_EVENT, () => {
        throw new Error('boom');
      });

      eventBus.emitAuditLog(null);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to emit AUDIT_LOG event',
        expect.objectContaining({
          action: undefined,
          resourceType: undefined,
        }),
      );
    });

    test('a failing listener does not prevent the next emit from succeeding', () => {
      let shouldThrow = true;
      const listener = jest.fn(() => {
        if (shouldThrow) throw new Error('transient');
      });
      eventBus.on(eventBus.AUDIT_LOG_EVENT, listener);

      expect(eventBus.emitAuditLog({ action: 'FIRST' })).toBe(false);

      shouldThrow = false;
      expect(eventBus.emitAuditLog({ action: 'SECOND' })).toBe(true);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    test("does not swallow errors from an async listener (they are the listener's to handle)", async () => {
      // audit.listener.js already wraps its own async work in try/catch.
      // emitAuditLog only guards the synchronous emit boundary.
      const rejection = jest.fn();
      eventBus.on(eventBus.AUDIT_LOG_EVENT, async () => {
        try {
          throw new Error('async failure');
        } catch (err) {
          rejection(err.message);
        }
      });

      expect(eventBus.emitAuditLog({ action: 'ASYNC' })).toBe(true);
      await Promise.resolve();
      expect(rejection).toHaveBeenCalledWith('async failure');
    });
  });
});
