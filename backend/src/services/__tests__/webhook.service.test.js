/**
 * @fileoverview Webhook Dispatch Service Tests
 * @description Verifies that AUDIT_LOG events are mapped to webhook events and
 * enqueued per active endpoint — and that unmapped events, missing tenants and
 * an unavailable Redis never crash the event bus.
 *
 * Issue: #645 (service never wired), completed in #474.
 */

const redisMock = { status: "ready" };
redisMock.isRedisAvailable = jest.fn(() => true);

jest.mock("../../config/redis", () => redisMock);
jest.mock("../../models/webhookEndpoint.model", () => ({ find: jest.fn() }));
jest.mock("bullmq", () => ({
  Queue: jest.fn(function Queue() {
    this.add = jest.fn().mockResolvedValue(true);
  }),
}));
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const eventBus = require("../event.service");
const WebhookEndpoint = require("../../models/webhookEndpoint.model");
const {
  webhookQueue,
  EVENT_MAPPING,
  initializeWebhookService,
  isWebhookServiceRegistered,
  unregisterWebhookService,
  handleAuditEvent,
} = require("../webhook.service");

const TENANT_ID = "65f0c2b1a1b2c3d4e5f6a7b9";

const mockEndpoints = (endpoints) => {
  WebhookEndpoint.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(endpoints),
  });
};

afterEach(() => {
  unregisterWebhookService();
  // clearAllMocks does not reset implementations, so undo the
  // "Redis unavailable" toggle from the previous test explicitly.
  redisMock.isRedisAvailable.mockReturnValue(true);
  jest.clearAllMocks();
});

describe("initializeWebhookService", () => {
  test("subscribes to AUDIT_LOG and is idempotent", () => {
    expect(isWebhookServiceRegistered()).toBe(false);

    expect(initializeWebhookService()).toBe(true);
    expect(isWebhookServiceRegistered()).toBe(true);
    expect(eventBus.listenerCount("AUDIT_LOG")).toBeGreaterThan(0);

    // A second call must not double-subscribe.
    expect(initializeWebhookService()).toBe(false);
  });

  test("unregisterWebhookService removes the subscription", () => {
    initializeWebhookService();
    unregisterWebhookService();

    expect(isWebhookServiceRegistered()).toBe(false);
  });
});

describe("EVENT_MAPPING", () => {
  test("maps the seven payroll and employee events", () => {
    for (const event of [
      "EMPLOYEE_CREATE",
      "EMPLOYEE_UPDATE",
      "EMPLOYEE_DELETE",
      "PAYROLL_FINALIZE",
      "PAYROLL_APPROVE",
      "PAYROLL_REJECT",
      "PAYROLL_PAID",
    ]) {
      expect(EVENT_MAPPING[event]).toBe(event);
    }
  });

  test("does not map other audited actions", () => {
    expect(EVENT_MAPPING["LOAN_ISSUE"]).toBeUndefined();
    expect(EVENT_MAPPING["SETTINGS_UPDATE"]).toBeUndefined();
  });
});

describe("handleAuditEvent", () => {
  test("enqueues one job per active endpoint subscribed to the event", async () => {
    mockEndpoints([
      { _id: "ep-1", url: "https://a.example/hook", secret: "s".repeat(32) },
      { _id: "ep-2", url: "https://b.example/hook", secret: "t".repeat(32) },
    ]);

    await handleAuditEvent({
      action: "PAYROLL_APPROVE",
      tenantId: TENANT_ID,
      details: { payrollId: "P-1" },
      resourceIds: ["payroll-1"],
    });

    expect(WebhookEndpoint.find).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      isActive: true,
      subscribedEvents: "PAYROLL_APPROVE",
    });

    expect(webhookQueue.add).toHaveBeenCalledTimes(2);
    expect(webhookQueue.add).toHaveBeenCalledWith(
      "deliver",
      expect.objectContaining({
        endpointId: "ep-1",
        tenantId: TENANT_ID,
        url: "https://a.example/hook",
        secret: "s".repeat(32),
        eventName: "PAYROLL_APPROVE",
      }),
    );

    const [name, payload] = webhookQueue.add.mock.calls[0];
    expect(name).toBe("deliver");
    expect(payload.payload).toMatchObject({
      event: "PAYROLL_APPROVE",
      data: { payrollId: "P-1" },
      resourceIds: ["payroll-1"],
    });
    expect(payload.payload.timestamp).toEqual(expect.any(String));
  });

  test("ignores events that are not in the webhook vocabulary", async () => {
    await handleAuditEvent({
      action: "LOAN_ISSUE",
      tenantId: TENANT_ID,
      details: {},
    });

    expect(WebhookEndpoint.find).not.toHaveBeenCalled();
    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  test("skips when the event carries no tenant", async () => {
    await handleAuditEvent({ action: "EMPLOYEE_CREATE", details: {} });

    expect(WebhookEndpoint.find).not.toHaveBeenCalled();
    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  test("skips enqueueing when no endpoint subscribes", async () => {
    mockEndpoints([]);

    await handleAuditEvent({ action: "EMPLOYEE_CREATE", tenantId: TENANT_ID });

    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  test("does not enqueue while Redis is unavailable", async () => {
    redisMock.isRedisAvailable.mockReturnValue(false);
    mockEndpoints([{ _id: "ep-1", url: "https://a.example/hook", secret: "s".repeat(32) }]);

    await handleAuditEvent({ action: "EMPLOYEE_CREATE", tenantId: TENANT_ID });

    expect(WebhookEndpoint.find).not.toHaveBeenCalled();
    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  test("never throws, so a broken enqueue cannot take down the event bus", async () => {
    mockEndpoints([{ _id: "ep-1", url: "https://a.example/hook", secret: "s".repeat(32) }]);
    webhookQueue.add.mockRejectedValueOnce(new Error("stream closed"));

    await expect(
      handleAuditEvent({ action: "EMPLOYEE_CREATE", tenantId: TENANT_ID }),
    ).resolves.toBeUndefined();
  });

  test("reads the tenant from the request when the event omits it", async () => {
    mockEndpoints([{ _id: "ep-1", url: "https://a.example/hook", secret: "s".repeat(32) }]);

    await handleAuditEvent({
      action: "PAYROLL_FINALIZE",
      req: { tenantId: TENANT_ID },
      details: {},
    });

    expect(webhookQueue.add).toHaveBeenCalledTimes(1);
  });
});
