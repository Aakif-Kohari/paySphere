/**
 * @fileoverview Webhook Worker Unit Tests
 * @description Tests HMAC signature generation, the backoff schedule, and the
 * delivery processor (POST + delivery logging).
 *
 * Issue: #645 (worker shipped untested and un-exported), completed in #474.
 */

jest.mock("axios", () => ({ post: jest.fn() }));
jest.mock("../models/webhookDelivery.model", () => ({ create: jest.fn() }));
jest.mock("../config/redis", () => {
  const connection = { status: "ready" };
  connection.isRedisAvailable = () => true;
  return connection;
});
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock("bullmq", () => {
  const Worker = jest.fn(function Worker() {});
  Worker.prototype.on = jest.fn();
  return { Worker };
});

const crypto = require("crypto");
const axios = require("axios");
const WebhookDelivery = require("../models/webhookDelivery.model");
const { Worker } = require("bullmq");
const {
  generateSignature,
  customBackoffStrategy,
  processWebhookJob,
  startWebhookWorker,
} = require("../workers/webhook.worker");

const JOB_DATA = {
  endpointId: "65f0c2b1a1b2c3d4e5f6a7b8",
  tenantId: "65f0c2b1a1b2c3d4e5f6a7b9",
  url: "https://example.com/hooks/payroll",
  secret: "a".repeat(32),
  eventName: "PAYROLL_APPROVE",
  payload: {
    event: "PAYROLL_APPROVE",
    timestamp: "2026-01-01T00:00:00.000Z",
    data: { payrollId: "P-1" },
    resourceIds: [],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateSignature", () => {
  test("matches a manual HMAC-SHA256 over the exact JSON body", () => {
    const expected = crypto
      .createHmac("sha256", JOB_DATA.secret)
      .update(JSON.stringify(JOB_DATA.payload))
      .digest("hex");

    expect(generateSignature(JOB_DATA.payload, JOB_DATA.secret)).toBe(expected);
    expect(generateSignature(JOB_DATA.payload, JOB_DATA.secret)).toHaveLength(64);
  });

  test("a different secret produces a different signature", () => {
    const payload = { event: "EMPLOYEE_CREATE" };
    expect(generateSignature(payload, "secret-one")).not.toBe(
      generateSignature(payload, "secret-two"),
    );
  });

  test("signs the serialized body, so the exact received body must be re-hashed", () => {
    // JSON.stringify preserves insertion order, so a receiver must verify the
    // digest against the body it actually received, byte for byte.
    expect(generateSignature({ a: 1, b: 2 }, "secret")).not.toBe(
      generateSignature({ b: 2, a: 1 }, "secret"),
    );
  });
});

describe("customBackoffStrategy", () => {
  test("retries at 1m, 5m, 30m, 2h and then stops", () => {
    expect(customBackoffStrategy(0)).toBe(60000);
    expect(customBackoffStrategy(1)).toBe(300000);
    expect(customBackoffStrategy(2)).toBe(1800000);
    expect(customBackoffStrategy(3)).toBe(7200000);
    expect(customBackoffStrategy(4)).toBeNull();
  });
});

describe("processWebhookJob", () => {
  test("POSTs the payload with the HMAC header and records a success", async () => {
    axios.post.mockResolvedValue({ status: 200, data: { ok: true } });

    const result = await processWebhookJob({ data: JOB_DATA, attemptsMade: 0 });

    expect(axios.post).toHaveBeenCalledWith(
      JOB_DATA.url,
      JOB_DATA.payload,
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-PaySphere-Signature": `sha256=${generateSignature(JOB_DATA.payload, JOB_DATA.secret)}`,
          "X-PaySphere-Event": JOB_DATA.eventName,
          "Content-Type": "application/json",
        }),
      }),
    );

    expect(result).toEqual({ success: true, status: 200 });
    expect(WebhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointId: JOB_DATA.endpointId,
        tenantId: JOB_DATA.tenantId,
        eventName: JOB_DATA.eventName,
        isSuccess: true,
        httpStatus: 200,
        attemptCount: 1,
      }),
    );
  });

  test("records a failure and rethrows on a network error", async () => {
    axios.post.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      processWebhookJob({ data: JOB_DATA, attemptsMade: 0 }),
    ).rejects.toThrow("ECONNREFUSED");

    expect(WebhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isSuccess: false,
        errorMessage: "ECONNREFUSED",
        attemptCount: 1,
        nextRetryAt: expect.any(Date),
      }),
    );
  });

  test("records a failure and rethrows on a non-2xx response", async () => {
    axios.post.mockResolvedValue({ status: 500, data: "boom" });

    await expect(
      processWebhookJob({ data: JOB_DATA, attemptsMade: 0 }),
    ).rejects.toThrow("Received HTTP 500");

    expect(WebhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({ isSuccess: false, httpStatus: 500 }),
    );
  });

  test("does not set nextRetryAt on the final attempt", async () => {
    axios.post.mockRejectedValue(new Error("timeout"));

    await expect(
      processWebhookJob({ data: JOB_DATA, attemptsMade: 4 }),
    ).rejects.toThrow("timeout");

    expect(WebhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({ nextRetryAt: null, attemptCount: 5 }),
    );
  });

  test("a delivered webhook is not re-sent when the log write fails", async () => {
    axios.post.mockResolvedValue({ status: 200, data: {} });
    WebhookDelivery.create.mockRejectedValueOnce(new Error("db down"));

    const result = await processWebhookJob({ data: JOB_DATA, attemptsMade: 0 });

    // Success is reported to BullMQ so the job is not retried — the receiver
    // already got the POST.
    expect(result).toEqual({ success: true, status: 200 });
  });

  test("a failure to log a failed delivery still surfaces the original error", async () => {
    axios.post.mockRejectedValue(new Error("ETIMEDOUT"));
    WebhookDelivery.create.mockRejectedValue(new Error("db down"));

    await expect(
      processWebhookJob({ data: JOB_DATA, attemptsMade: 0 }),
    ).rejects.toThrow("ETIMEDOUT");
  });
});

describe("startWebhookWorker", () => {
  test("creates one worker, subscribes to its events and is idempotent", () => {
    const first = startWebhookWorker();

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker.prototype.on).toHaveBeenCalledWith("completed", expect.any(Function));
    expect(Worker.prototype.on).toHaveBeenCalledWith("failed", expect.any(Function));

    const second = startWebhookWorker();
    expect(first).toBe(second);
    expect(Worker).toHaveBeenCalledTimes(1);
  });
});
