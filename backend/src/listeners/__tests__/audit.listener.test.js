const fs = require('fs');
const path = require('path');

jest.mock('../../services/audit.service', () => ({
  createAuditLog: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const eventBus = require('../../services/event.service');
const { createAuditLog } = require('../../services/audit.service');
const {
  registerAuditListener,
  isAuditListenerRegistered,
  unregisterAuditListener,
  handleAuditEvent,
} = require('../audit.listener');
const logger = require('../../utils/logger');

const INDEX_SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../index.js'),
  'utf8',
);

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  unregisterAuditListener();
});

afterAll(() => {
  unregisterAuditListener();
});

/**
 * The bug: this listener registered itself as a side effect of being required,
 * and nothing in the tree required it. Every emit was a no-op and the AuditLog
 * collection was empty (#664).
 */
describe('audit.listener — the subscription that was never made (#664)', () => {
  describe('registration', () => {
    test('nothing is listening until registerAuditListener is called', () => {
      expect(isAuditListenerRegistered()).toBe(false);
    });

    test('registering subscribes to AUDIT_LOG', () => {
      expect(registerAuditListener()).toBe(true);
      expect(isAuditListenerRegistered()).toBe(true);
    });

    test('registering twice does not double-subscribe', () => {
      registerAuditListener();
      const second = registerAuditListener();

      expect(second).toBe(false);
      expect(eventBus.listenerCount('AUDIT_LOG')).toBe(1);
    });

    test('an emitted event reaches createAuditLog once', async () => {
      registerAuditListener();

      eventBus.emit('AUDIT_LOG', {
        userId: 'u1',
        action: 'PAYROLL_APPROVE',
        resourceType: 'Payroll',
      });
      await flush();

      expect(createAuditLog).toHaveBeenCalledTimes(1);
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_APPROVE' }),
      );
    });

    test('an emit before registration writes nothing — the reported failure', async () => {
      eventBus.emit('AUDIT_LOG', {
        userId: 'u1',
        action: 'PAYROLL_FINALIZE',
        resourceType: 'Payroll',
      });
      await flush();

      expect(createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('boot sequence', () => {
    test('index.js registers the listener', () => {
      // The whole bug in one assertion. Requiring the module for its side
      // effect is what got dropped last time, so the boot sequence calls it.
      expect(INDEX_SOURCE).toMatch(
        /require\(["']\.\/listeners\/audit\.listener["']\)/,
      );
      expect(INDEX_SOURCE).toMatch(/registerAuditListener\(\)/);
    });

    test('registration happens before the server starts listening', () => {
      const registration = INDEX_SOURCE.indexOf('registerAuditListener()');
      const listen = INDEX_SOURCE.indexOf('app.listen(');

      expect(registration).toBeGreaterThan(-1);
      expect(registration).toBeLessThan(listen);
    });
  });

  describe('failure handling', () => {
    test('a throwing createAuditLog does not become an unhandled rejection', async () => {
      createAuditLog.mockRejectedValueOnce(new Error('mongo is down'));

      await expect(
        handleAuditEvent({ action: 'PAYROLL_APPROVE', resourceType: 'Payroll' }),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to process an audit event',
        expect.objectContaining({ error: 'mongo is down' }),
      );
    });

    test('a malformed payload is logged, not thrown', async () => {
      createAuditLog.mockRejectedValueOnce(new Error('bad payload'));

      await expect(handleAuditEvent(undefined)).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
