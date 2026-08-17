/**
 * @fileoverview Role Routes Tests
 * @description Every role route must be authenticated and gated on
 * MANAGE_ROLES, and the permission must exist in the RBAC vocabulary (#475).
 */

jest.mock("../../middlewares/auth.middleware", () => jest.fn());
jest.mock("../../middlewares/rbac.middleware", () => ({
  requirePermission: jest.fn((permission) => {
    const guard = jest.fn();
    guard.permission = permission;
    return guard;
  }),
}));
jest.mock("../../controllers/role.controller", () => ({
  getRoles: jest.fn(),
  createRole: jest.fn(),
  updateRole: jest.fn(),
  deleteRole: jest.fn(),
}));

const router = require("../role.routes");
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

describe("role.routes — every route gated on MANAGE_ROLES (#475)", () => {
  test("every route is authenticated", () => {
    for (const route of registeredRoutes()) {
      expect(route.handlers).toContain(auth);
    }
  });

  test("every route requires MANAGE_ROLES, reads included", () => {
    // The list names every capability in the company and which roles hold them,
    // so even the GET is security-relevant (same call as the webhooks routes).
    for (const route of registeredRoutes()) {
      expect(permissionFor(route)).toBe(PERMISSIONS.MANAGE_ROLES);
    }
  });

  test("the four CRUD routes exist", () => {
    expect(routeFor("get", "/")).toBeDefined();
    expect(routeFor("post", "/")).toBeDefined();
    expect(routeFor("patch", "/:id")).toBeDefined();
    expect(routeFor("delete", "/:id")).toBeDefined();
  });
});

describe("MANAGE_ROLES in the RBAC vocabulary (#475)", () => {
  test("the permission is defined so the seeder creates it", () => {
    expect(PERMISSION_DEFINITIONS.map((d) => d.name)).toContain(
      PERMISSIONS.MANAGE_ROLES,
    );
  });

  test("the owner role holds it", () => {
    expect(permissionsOf(ROLES.SUPER_ADMIN)).toContain(PERMISSIONS.MANAGE_ROLES);
  });

  test("HR managers and employees do not", () => {
    expect(permissionsOf(ROLES.HR_MANAGER)).not.toContain(PERMISSIONS.MANAGE_ROLES);
    expect(permissionsOf(ROLES.EMPLOYEE)).not.toContain(PERMISSIONS.MANAGE_ROLES);
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
