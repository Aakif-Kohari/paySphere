/**
 * @fileoverview Webhook Controller Tests
 * @description CRUD validation, tenant scoping, secret handling and audit
 * emissions for the webhook endpoints (#474).
 */

jest.mock("../../models/webhookEndpoint.model", () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const WebhookEndpoint = jest.fn(function WebhookEndpoint(doc) {
    Object.assign(this, doc);
    this._id = "webhook-1";
    this.save = save;
  });
  WebhookEndpoint.find = jest.fn();
  WebhookEndpoint.findOne = jest.fn();
  WebhookEndpoint.findOneAndDelete = jest.fn();
  WebhookEndpoint.__save = save;
  return WebhookEndpoint;
});
jest.mock("../../models/webhookDelivery.model", () => ({ find: jest.fn() }));
jest.mock("../../services/event.service", () => ({
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  listeners: jest.fn(() => []),
  AUDIT_LOG_EVENT: "AUDIT_LOG",
}));
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mongoose = require("mongoose");
const WebhookEndpoint = require("../../models/webhookEndpoint.model");
const WebhookDelivery = require("../../models/webhookDelivery.model");
const eventBus = require("../../services/event.service");
const {
  createWebhook,
  getWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  regenerateWebhookSecret,
  getWebhookDeliveries,
  validateUrl,
  validateEvents,
  maskSecret,
  generateSecret,
  SUBSCRIBABLE_EVENTS,
} = require("../webhook.controller");

const TENANT_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();
const WEBHOOK_ID = new mongoose.Types.ObjectId().toString();

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildReq = (body = {}, overrides = {}) => ({
  userId: USER_ID,
  tenantId: TENANT_ID,
  params: { id: WEBHOOK_ID },
  body,
  ip: "127.0.0.1",
  headers: {},
  ...overrides,
});

const makeEndpointDoc = (overrides = {}) => ({
  _id: WEBHOOK_ID,
  tenantId: TENANT_ID,
  url: "https://example.com/hooks/payroll",
  secret: "s".repeat(32),
  subscribedEvents: ["PAYROLL_APPROVE"],
  isActive: true,
  description: "Prod hooks",
  createdBy: USER_ID,
  save: jest.fn().mockResolvedValue(undefined),
  toObject: function toObject() {
    return { ...this };
  },
  ...overrides,
});

const makeLeanQuery = (result) => ({ lean: jest.fn().mockResolvedValue(result) });

beforeEach(() => {
  jest.clearAllMocks();
  WebhookEndpoint.__save.mockResolvedValue(undefined);
});

describe("validation helpers", () => {
  test("validateUrl accepts http(s) URLs and rejects everything else", () => {
    expect(validateUrl("https://example.com/hook").ok).toBe(true);
    expect(validateUrl("http://example.com/hook").ok).toBe(true);
    expect(validateUrl("ftp://example.com").ok).toBe(false);
    expect(validateUrl("not a url").ok).toBe(false);
    expect(validateUrl(42).ok).toBe(false);
  });

  test("validateEvents rejects empty, non-array and unknown events", () => {
    expect(validateEvents([]).ok).toBe(false);
    expect(validateEvents("PAYROLL_APPROVE").ok).toBe(false);
    expect(validateEvents(["NOT_AN_EVENT"]).ok).toBe(false);
    expect(validateEvents(["PAYROLL_APPROVE", "EMPLOYEE_CREATE"]).ok).toBe(true);
  });

  test("validateEvents de-duplicates", () => {
    const result = validateEvents(["PAYROLL_APPROVE", "PAYROLL_APPROVE"]);
    expect(result.events).toEqual(["PAYROLL_APPROVE"]);
  });

  test("SUBSCRIBABLE_EVENTS matches the seven dispatchable events", () => {
    expect(SUBSCRIBABLE_EVENTS).toEqual([
      "EMPLOYEE_CREATE",
      "EMPLOYEE_UPDATE",
      "EMPLOYEE_DELETE",
      "PAYROLL_FINALIZE",
      "PAYROLL_APPROVE",
      "PAYROLL_REJECT",
      "PAYROLL_PAID",
    ]);
  });

  test("maskSecret never reveals the full secret", () => {
    const masked = maskSecret("s".repeat(32));
    expect(masked).toContain("••••");
    expect(masked).not.toContain("s".repeat(8));
  });

  test("generateSecret returns 64 hex chars", () => {
    expect(generateSecret()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("createWebhook", () => {
  test("creates an endpoint with a server-generated secret and audits it", async () => {
    const res = buildRes();
    const req = buildReq({
      url: "  https://example.com/hooks/payroll  ",
      subscribedEvents: ["PAYROLL_APPROVE", "EMPLOYEE_CREATE"],
      description: "  Prod hooks  ",
    });

    await createWebhook(req, res, jest.fn());

    expect(WebhookEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        url: "https://example.com/hooks/payroll",
        subscribedEvents: ["PAYROLL_APPROVE", "EMPLOYEE_CREATE"],
        description: "Prod hooks",
        createdBy: USER_ID,
        secret: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );

    expect(WebhookEndpoint.__save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(eventBus.emit).toHaveBeenCalledWith(
      "AUDIT_LOG",
      expect.objectContaining({
        userId: USER_ID,
        action: "WEBHOOK_CREATE",
        resourceType: "Webhook",
        resourceIds: ["webhook-1"],
      }),
    );
  });

  test.each([
    ["not a url", "url must be a valid http(s) URL"],
    ["ftp://example.com", "url must be a valid http(s) URL"],
  ])("rejects an invalid url: %s", async (url, message) => {
    const res = buildRes();
    await createWebhook(buildReq({ url, subscribedEvents: ["EMPLOYEE_CREATE"] }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message });
    expect(WebhookEndpoint).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  test("rejects an empty or unknown event list", async () => {
    const res = buildRes();
    await createWebhook(
      buildReq({ url: "https://example.com/hook", subscribedEvents: [] }),
      res,
      jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(400);

    jest.clearAllMocks();
    await createWebhook(
      buildReq({ url: "https://example.com/hook", subscribedEvents: ["NOPE"] }),
      res,
      jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(WebhookEndpoint).not.toHaveBeenCalled();
  });

  test("rejects an over-long description", async () => {
    const res = buildRes();
    await createWebhook(
      buildReq({
        url: "https://example.com/hook",
        subscribedEvents: ["EMPLOYEE_CREATE"],
        description: "x".repeat(201),
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(WebhookEndpoint).not.toHaveBeenCalled();
  });
});

describe("getWebhooks", () => {
  test("lists the tenant's endpoints with masked secrets", async () => {
    WebhookEndpoint.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: WEBHOOK_ID, url: "https://a.example/hook", secret: "s".repeat(32) },
        ]),
      }),
    });

    const res = buildRes();
    await getWebhooks(buildReq(), res, jest.fn());

    expect(WebhookEndpoint.find).toHaveBeenCalledWith({ tenantId: TENANT_ID });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ secret: expect.stringContaining("••••") }),
    ]);
  });
});

describe("getWebhook", () => {
  test("rejects a malformed id", async () => {
    const res = buildRes();
    await getWebhook(buildReq({}, { params: { id: "not-an-id" } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("404s for another tenant's or missing endpoint", async () => {
    WebhookEndpoint.findOne.mockReturnValue(makeLeanQuery(null));
    const res = buildRes();
    await getWebhook(buildReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("returns the endpoint with a masked secret", async () => {
    WebhookEndpoint.findOne.mockReturnValue(
      makeLeanQuery({ _id: WEBHOOK_ID, url: "https://a.example/hook", secret: "s".repeat(32) }),
    );
    const res = buildRes();
    await getWebhook(buildReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ secret: expect.stringContaining("••••") }),
    );
  });
});

describe("updateWebhook", () => {
  test("404s when the endpoint does not exist", async () => {
    WebhookEndpoint.findOne.mockResolvedValue(null);
    const res = buildRes();
    await updateWebhook(
      buildReq({ isActive: false }),
      res,
      jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("updates fields, saves and audits", async () => {
    const doc = makeEndpointDoc();
    WebhookEndpoint.findOne.mockResolvedValue(doc);

    const res = buildRes();
    await updateWebhook(
      buildReq({ isActive: false, description: "Updated" }),
      res,
      jest.fn(),
    );

    expect(doc.isActive).toBe(false);
    expect(doc.description).toBe("Updated");
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(eventBus.emit).toHaveBeenCalledWith(
      "AUDIT_LOG",
      expect.objectContaining({ action: "WEBHOOK_UPDATE", resourceType: "Webhook" }),
    );
  });

  test("rejects an update with nothing to change", async () => {
    WebhookEndpoint.findOne.mockResolvedValue(makeEndpointDoc());
    const res = buildRes();
    await updateWebhook(buildReq({}), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("rejects a non-boolean isActive", async () => {
    WebhookEndpoint.findOne.mockResolvedValue(makeEndpointDoc());
    const res = buildRes();
    await updateWebhook(buildReq({ isActive: "yes" }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("deleteWebhook", () => {
  test("deletes within the tenant and audits", async () => {
    WebhookEndpoint.findOneAndDelete.mockResolvedValue({ _id: WEBHOOK_ID, url: "https://a.example/hook" });

    const res = buildRes();
    await deleteWebhook(buildReq(), res, jest.fn());

    expect(WebhookEndpoint.findOneAndDelete).toHaveBeenCalledWith({
      _id: WEBHOOK_ID,
      tenantId: TENANT_ID,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(eventBus.emit).toHaveBeenCalledWith(
      "AUDIT_LOG",
      expect.objectContaining({ action: "WEBHOOK_DELETE", resourceType: "Webhook" }),
    );
  });

  test("404s when nothing matched", async () => {
    WebhookEndpoint.findOneAndDelete.mockResolvedValue(null);
    const res = buildRes();
    await deleteWebhook(buildReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("regenerateWebhookSecret", () => {
  test("rotates the secret, persists it and audits", async () => {
    const doc = makeEndpointDoc();
    WebhookEndpoint.findOne.mockResolvedValue(doc);

    const res = buildRes();
    await regenerateWebhookSecret(buildReq(), res, jest.fn());

    expect(doc.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(doc.secret).not.toBe("s".repeat(32));
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ secret: expect.stringMatching(/^[0-9a-f]{64}$/) }),
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      "AUDIT_LOG",
      expect.objectContaining({
        action: "WEBHOOK_SECRET_REGENERATED",
        resourceType: "Webhook",
      }),
    );
  });

  test("404s when the endpoint does not exist", async () => {
    WebhookEndpoint.findOne.mockResolvedValue(null);
    const res = buildRes();
    await regenerateWebhookSecret(buildReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("getWebhookDeliveries", () => {
  test("lists the latest deliveries for the tenant's endpoint", async () => {
    WebhookEndpoint.findOne.mockReturnValue(makeLeanQuery({ _id: WEBHOOK_ID }));
    WebhookDelivery.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { endpointId: WEBHOOK_ID, eventName: "PAYROLL_APPROVE", isSuccess: true },
          ]),
        }),
      }),
    });

    const res = buildRes();
    await getWebhookDeliveries(buildReq(), res, jest.fn());

    expect(WebhookDelivery.find).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      endpointId: WEBHOOK_ID,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ isSuccess: true }),
    ]);
  });

  test("404s when the endpoint does not belong to the tenant", async () => {
    WebhookEndpoint.findOne.mockReturnValue(makeLeanQuery(null));
    const res = buildRes();
    await getWebhookDeliveries(buildReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(WebhookDelivery.find).not.toHaveBeenCalled();
  });
});
