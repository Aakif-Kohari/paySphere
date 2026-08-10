const eventBus = require('../../services/event.service');
const { notifyFromAuditEvent } = require('../../services/notification.service');
const {
  registerNotificationListener,
  isNotificationListenerRegistered,
  unregisterNotificationListener,
  handleNotificationEvent,
} = require('../notification.listener');

jest.mock('../../services/notification.service', () => ({
  notifyFromAuditEvent: jest.fn().mockResolvedValue(1),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { AUDIT_LOG_EVENT } = eventBus;

afterEach(() => {
  unregisterNotificationListener();
  jest.clearAllMocks();
});

/**
 * `notification.listener.js` (#898).
 *
 * Shaped like `audit.listener.js` on purpose, and tested for the same property:
 * #664 happened because that file registered its handler as a side effect of
 * being required and nothing ever required it, so thirty-three emits fired into
 * an emitter with no subscribers for the life of the product. Asserting "the
 * file exists" would not have caught it. Asserting "something is subscribed"
 * does.
 */

describe('registration (#898)', () => {
  test('subscribes to AUDIT_LOG', () => {
    expect(isNotificationListenerRegistered()).toBe(false);

    expect(registerNotificationListener()).toBe(true);
    expect(isNotificationListenerRegistered()).toBe(true);
  });

  test('is idempotent — registering twice does not double every notification', () => {
    registerNotificationListener();
    const before = eventBus.listenerCount(AUDIT_LOG_EVENT);

    expect(registerNotificationListener()).toBe(false);
    expect(eventBus.listenerCount(AUDIT_LOG_EVENT)).toBe(before);
  });

  test('reports honestly when the subscription is removed', () => {
    registerNotificationListener();
    unregisterNotificationListener();

    expect(isNotificationListenerRegistered()).toBe(false);
  });

  test('does not mistake the audit listener for itself', () => {
    // Both subscribe to AUDIT_LOG, so a listener *count* would report true
    // while only the audit one is attached — which is precisely the failure
    // this check exists to detect. It asks for this handler by identity.
    const other = jest.fn();
    eventBus.on(AUDIT_LOG_EVENT, other);

    expect(eventBus.listenerCount(AUDIT_LOG_EVENT)).toBeGreaterThan(0);
    expect(isNotificationListenerRegistered()).toBe(false);

    eventBus.off(AUDIT_LOG_EVENT, other);
  });

  test('the boot sequence wires it up', () => {
    // The one assertion that would have caught #664. `index.js` calls this in
    // the same sequence as seedRbac() and startCronJobs(), rather than relying
    // on a side-effect import — because an import that looks unused is an
    // import somebody deletes.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'index.js'),
      'utf8',
    );

    expect(source).toMatch(/registerNotificationListener\(\)/);
    expect(source).toMatch(
      /require\(['"]\.\/listeners\/notification\.listener['"]\)/,
    );
  });
});

describe('handling an event', () => {
  test('an emitted event reaches the service', async () => {
    registerNotificationListener();

    eventBus.emit(AUDIT_LOG_EVENT, { action: 'PAYROLL_APPROVE' });
    await Promise.resolve();

    expect(notifyFromAuditEvent).toHaveBeenCalledWith({
      action: 'PAYROLL_APPROVE',
    });
  });

  test('the payload is passed through untouched', async () => {
    registerNotificationListener();
    const payload = {
      userId: 'u1',
      action: 'EXPENSE_SUBMIT',
      req: { tenantId: 't1' },
    };

    eventBus.emit(AUDIT_LOG_EVENT, payload);
    await Promise.resolve();

    expect(notifyFromAuditEvent).toHaveBeenCalledWith(payload);
  });
});

describe('a failure here cannot reach the request (#898)', () => {
  test('a rejecting service does not produce an unhandled rejection', async () => {
    notifyFromAuditEvent.mockRejectedValue(new Error('mongo is down'));

    await expect(
      handleNotificationEvent({ action: 'PAYROLL_APPROVE' }),
    ).resolves.toBeUndefined();
  });

  test('a throwing service does not propagate back into the emitter', () => {
    // `EventEmitter.emit` is synchronous, so an exception thrown by a
    // subscriber lands in the controller that emitted — a 500 for an operation
    // that had already committed.
    notifyFromAuditEvent.mockImplementation(() => {
      throw new Error('boom');
    });
    registerNotificationListener();

    expect(() =>
      eventBus.emit(AUDIT_LOG_EVENT, { action: 'PAYROLL_APPROVE' }),
    ).not.toThrow();
  });

  test('a malformed payload does not throw', async () => {
    notifyFromAuditEvent.mockRejectedValue(new Error('nope'));

    await expect(handleNotificationEvent(undefined)).resolves.toBeUndefined();
  });
});
