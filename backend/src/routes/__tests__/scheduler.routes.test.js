jest.mock('../../middlewares/auth.middleware', () => jest.fn());
jest.mock('../../middlewares/rbac.middleware', () => ({
  requirePermission: jest.fn((permission) => {
    const guard = jest.fn();
    guard.permission = permission;
    return guard;
  }),
}));
jest.mock('../../controllers/scheduler.controller', () => ({
  createSchedule: jest.fn(),
  getSchedules: jest.fn(),
  deleteSchedule: jest.fn(),
}));

const router = require('../scheduler.routes');
const auth = require('../../middlewares/auth.middleware');
const {
  PERMISSIONS,
  ROLE_DEFINITIONS,
  ROLES,
  PERMISSION_DEFINITIONS,
} = require('../../config/permissions');

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

describe('scheduler.routes — write routes gated on a read permission (#666)', () => {
  test('every route is authenticated', () => {
    for (const route of registeredRoutes()) {
      expect(route.handlers).toContain(auth);
    }
  });

  test('creating a schedule needs MANAGE_REPORT_SCHEDULE', () => {
    // It required READ_REPORT, which every role holds — so anyone who could
    // view a report could stand up a recurring export of payroll data to an
    // address of their choosing.
    expect(permissionFor(routeFor('post', '/'))).toBe(
      PERMISSIONS.MANAGE_REPORT_SCHEDULE,
    );
  });

  test('deleting a schedule needs MANAGE_REPORT_SCHEDULE', () => {
    expect(permissionFor(routeFor('delete', '/:id'))).toBe(
      PERMISSIONS.MANAGE_REPORT_SCHEDULE,
    );
  });

  test('listing schedules stays on READ_REPORT', () => {
    // Seeing which reports are scheduled genuinely is the same kind of act as
    // reading one; only the writes moved.
    expect(permissionFor(routeFor('get', '/'))).toBe(PERMISSIONS.READ_REPORT);
  });

  test('no write route is guarded by READ_REPORT any more', () => {
    for (const method of ['post', 'delete', 'put', 'patch']) {
      for (const route of registeredRoutes().filter((r) => r.method === method)) {
        expect(permissionFor(route)).not.toBe(PERMISSIONS.READ_REPORT);
      }
    }
  });
});

describe('MANAGE_REPORT_SCHEDULE in the RBAC vocabulary (#666)', () => {
  test('the permission is defined so the seeder creates it', () => {
    // A route asking for a permission the seeder never writes is a permanent
    // 403 — the failure mode #413 was filed for.
    expect(
      PERMISSION_DEFINITIONS.map((d) => d.name),
    ).toContain(PERMISSIONS.MANAGE_REPORT_SCHEDULE);
  });

  test('the owner role holds it', () => {
    expect(permissionsOf(ROLES.SUPER_ADMIN)).toContain(
      PERMISSIONS.MANAGE_REPORT_SCHEDULE,
    );
  });

  test('HR managers and employees do not', () => {
    expect(permissionsOf(ROLES.HR_MANAGER)).not.toContain(
      PERMISSIONS.MANAGE_REPORT_SCHEDULE,
    );
    expect(permissionsOf(ROLES.EMPLOYEE)).not.toContain(
      PERMISSIONS.MANAGE_REPORT_SCHEDULE,
    );
  });

  test('every permission a role references is one the seeder defines', () => {
    const defined = new Set(PERMISSION_DEFINITIONS.map((d) => d.name));

    for (const role of ROLE_DEFINITIONS) {
      for (const permission of role.permissions) {
        expect(defined).toContain(permission);
      }
    }
  });
});
