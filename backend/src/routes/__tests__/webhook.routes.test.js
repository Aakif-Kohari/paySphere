/**
 * @fileoverview Webhook Routes Tests
 * @description Every webhook route must be authenticated and gated on
 * MANAGE_WEBHOOKS, and the permission must exist in the RBAC vocabulary (#474).
 */

jest.mock("../../middlewares/auth.middleware", () => jest.fn());
jest.mock("../../middlewares/rbac.middleware", () => ({
  requirePermission: jest.fn((permission) => {
    const guard = jest.fn();
    guard.permission = permission;
    return guard;
  }),
}));
jest.mock("../../controllers/webhook.controller", () => ({
  createWebhook: jest.fn(),
  getWebhooks: jest.fn(),
  getWebhook: jest.fn(),
  updateWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
  regenerateWebhookSecret: jest.fn(),
  getWebhookDeliveries: jest.fn(),
}));

const router = require("../webhook.routes");
const auth = require("../../middlewares/auth.middleware");
const {
  PERMISSIONS,
  ROLE_DEFINITIONS,
  ROLES,
  PERMISSION_DEFINITIONS,
} = require("../../config/permissions");

const registeredRoutes = () =>
  router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => ({
        path: layer.route.path,
        method,
        handlers: layer.route.stack.map((s) => s.handle),
      })),
    );

const routeFor = (method, path) =>
  registeredRoutes().find((r) => r.method === method && r.path === path);

const permissionFor = (route) =>
  route.handlers.find((h) => h.permission)?.permission;

const permissionsOf = (roleName) =>
  ROLE_DEFINITIONS.find((r) => r.name === roleName).permissions;

describe("webhook.routes — every route gated on MANAGE_WEBHOOKS (#474)", () => {
  test("every route is authenticated", () => {
    for (const route of registeredRoutes()) {
      expect(route.handlers).toContain(auth);
    }
  });

  test("every route requires MANAGE_WEBHOOKS, reads included", () => {
    // Unlike the report schedules, even listing webhooks is security-relevant:
    // the list names every URL company data is being sent to.
    for (const route of registeredRoutes()) {
      expect(permissionFor(route)).toBe(PERMISSIONS.MANAGE_WEBHOOKS);
    }
  });

  test("the write routes exist", () => {
    expect(routeFor("post", "/")).toBeDefined();
    expect(routeFor("patch", "/:id")).toBeDefined();
    expect(routeFor("delete", "/:id")).toBeDefined();
  });

  test("the secret rotation and delivery-log routes exist", () => {
    expect(routeFor("post", "/:id/regenerate-secret")).toBeDefined();
    expect(routeFor("get", "/:id/deliveries")).toBeDefined();
  });
});

describe("MANAGE_WEBHOOKS in the RBAC vocabulary (#474)", () => {
  test("the permission is defined so the seeder creates it", () => {
    // A route asking for a permission the seeder never writes is a permanent
    // 403 — the failure mode #413 was filed for.
    expect(PERMISSION_DEFINITIONS.map((d) => d.name)).toContain(
      PERMISSIONS.MANAGE_WEBHOOKS,
    );
  });

  test("the owner role holds it", () => {
    expect(permissionsOf(ROLES.SUPER_ADMIN)).toContain(
      PERMISSIONS.MANAGE_WEBHOOKS,
    );
  });

  test("HR managers and employees do not", () => {
    expect(permissionsOf(ROLES.HR_MANAGER)).not.toContain(
      PERMISSIONS.MANAGE_WEBHOOKS,
    );
    expect(permissionsOf(ROLES.EMPLOYEE)).not.toContain(
      PERMISSIONS.MANAGE_WEBHOOKS,
    );
  });

  test("every permission a role references is one the seeder defines", () => {
    const defined = new Set(PERMISSION_DEFINITIONS.map((d) => d.name));

    for (const role of ROLE_DEFINITIONS) {
      for (const permission of role.permissions) {
        expect(defined).toContain(permission);
      }
    }
  });
});
