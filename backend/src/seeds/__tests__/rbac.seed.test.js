const Permission = require("../../models/permission.model");
const Role = require("../../models/role.model");
const User = require("../../models/user.model");
const logger = require("../../utils/logger");
const {
  seedRbac,
  seedPermissions,
  seedRoles,
  backfillUserRoles,
  getDefaultRole,
} = require("../rbac.seed");
const {
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  PERMISSIONS,
  ROLES,
  DEFAULT_ROLE,
} = require("../../config/permissions");

jest.mock("../../models/permission.model");
jest.mock("../../models/role.model");
jest.mock("../../models/user.model");
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

const allPermissionDocs = () =>
  PERMISSION_DEFINITIONS.map((d) => ({ _id: `perm-${d.name}`, name: d.name }));

const allRoleDocs = () =>
  ROLE_DEFINITIONS.map((d) => ({ _id: `role-${d.name}`, name: d.name }));

describe("config/permissions", () => {
  test("every role references only declared permissions", () => {
    const declared = new Set(PERMISSION_DEFINITIONS.map((d) => d.name));

    for (const role of ROLE_DEFINITIONS) {
      for (const permission of role.permissions) {
        expect(declared.has(permission)).toBe(true);
      }
    }
  });

  test("every declared permission is granted by at least one role", () => {
    const granted = new Set(ROLE_DEFINITIONS.flatMap((r) => r.permissions));

    for (const definition of PERMISSION_DEFINITIONS) {
      expect(granted.has(definition.name)).toBe(true);
    }
  });

  test("role names match the enum on the Role schema", () => {
    const names = ROLE_DEFINITIONS.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        ROLES.SUPER_ADMIN,
        ROLES.HR_MANAGER,
        ROLES.EMPLOYEE,
      ]),
    );
  });

  test("SuperAdmin holds every permission", () => {
    const superAdmin = ROLE_DEFINITIONS.find(
      (r) => r.name === ROLES.SUPER_ADMIN,
    );
    expect(superAdmin.permissions.sort()).toEqual(
      PERMISSION_DEFINITIONS.map((d) => d.name).sort(),
    );
  });

  test("the default role is one that actually gets seeded", () => {
    expect(ROLE_DEFINITIONS.map((r) => r.name)).toContain(DEFAULT_ROLE);
  });

  test("HRManager cannot delete employees", () => {
    const hr = ROLE_DEFINITIONS.find((r) => r.name === ROLES.HR_MANAGER);
    expect(hr.permissions).not.toContain(PERMISSIONS.DELETE_EMPLOYEE);
  });

  test("Employee is read-only", () => {
    const employee = ROLE_DEFINITIONS.find((r) => r.name === ROLES.EMPLOYEE);
    expect(employee.permissions).not.toContain(PERMISSIONS.WRITE_EMPLOYEE);
    expect(employee.permissions).not.toContain(PERMISSIONS.WRITE_PAYROLL);
    expect(employee.permissions).not.toContain(PERMISSIONS.DELETE_EMPLOYEE);
  });
});

describe("seedPermissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Permission.bulkWrite.mockResolvedValue({});
    Permission.find.mockResolvedValue(allPermissionDocs());
  });

  test("upserts one operation per declared permission", async () => {
    await seedPermissions();

    const [operations] = Permission.bulkWrite.mock.calls[0];
    expect(operations).toHaveLength(PERMISSION_DEFINITIONS.length);
    expect(operations[0].updateOne.upsert).toBe(true);
  });

  test("filters on name so existing documents keep their _id", async () => {
    await seedPermissions();

    const [operations] = Permission.bulkWrite.mock.calls[0];
    for (const op of operations) {
      expect(Object.keys(op.updateOne.filter)).toEqual(["name"]);
    }
  });

  test("returns a name -> document map", async () => {
    const result = await seedPermissions();

    expect(result.size).toBe(PERMISSION_DEFINITIONS.length);
    expect(result.get(PERMISSIONS.WRITE_PAYROLL)._id).toBe(
      "perm-WRITE_PAYROLL",
    );
  });

  test("is idempotent — a second run issues the same upserts", async () => {
    await seedPermissions();
    await seedPermissions();

    const [first] = Permission.bulkWrite.mock.calls[0];
    const [second] = Permission.bulkWrite.mock.calls[1];
    expect(second).toEqual(first);
  });
});

describe("seedRoles", () => {
  let permissionMap;

  beforeEach(() => {
    jest.clearAllMocks();
    permissionMap = new Map(allPermissionDocs().map((p) => [p.name, p]));
    Role.bulkWrite.mockResolvedValue({});
    Role.find.mockResolvedValue(allRoleDocs());
  });

  test("upserts one operation per declared role", async () => {
    await seedRoles(permissionMap);

    const [operations] = Role.bulkWrite.mock.calls[0];
    expect(operations).toHaveLength(ROLE_DEFINITIONS.length);
  });

  test("resolves permission names to ObjectIds", async () => {
    await seedRoles(permissionMap);

    const [operations] = Role.bulkWrite.mock.calls[0];
    const superAdminOp = operations.find(
      (op) => op.updateOne.filter.name === ROLES.SUPER_ADMIN,
    );

    expect(superAdminOp.updateOne.update.$set.permissions).toEqual(
      expect.arrayContaining(["perm-READ_EMPLOYEE", "perm-WRITE_PAYROLL"]),
    );
  });

  test("warns when a role references a permission that was not seeded", async () => {
    permissionMap.delete(PERMISSIONS.DELETE_EMPLOYEE);

    await seedRoles(permissionMap);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("references unknown permissions"),
      expect.objectContaining({ missing: [PERMISSIONS.DELETE_EMPLOYEE] }),
    );
  });

  test("returns a name -> document map", async () => {
    const result = await seedRoles(permissionMap);

    expect(result.get(ROLES.SUPER_ADMIN)._id).toBe("role-SuperAdmin");
  });
});

describe("backfillUserRoles", () => {
  let roleMap;

  beforeEach(() => {
    jest.clearAllMocks();
    roleMap = new Map(allRoleDocs().map((r) => [r.name, r]));
  });

  test("assigns the default role to users that have none", async () => {
    User.updateMany.mockResolvedValue({ modifiedCount: 3 });

    const updated = await backfillUserRoles(roleMap);

    expect(User.updateMany).toHaveBeenCalledWith(
      { $or: [{ role: { $exists: false } }, { role: null }] },
      { $set: { role: `role-${DEFAULT_ROLE}` } },
    );
    expect(updated).toBe(3);
  });

  test("does not touch users that already have a role", async () => {
    User.updateMany.mockResolvedValue({ modifiedCount: 0 });

    const updated = await backfillUserRoles(roleMap);

    const [filter] = User.updateMany.mock.calls[0];
    expect(filter.$or).toEqual([
      { role: { $exists: false } },
      { role: null },
    ]);
    expect(updated).toBe(0);
  });

  test("returns 0 and logs when the default role is missing", async () => {
    const updated = await backfillUserRoles(new Map());

    expect(updated).toBe(0);
    expect(User.updateMany).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Cannot backfill user roles"),
    );
  });
});

describe("seedRbac", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Permission.bulkWrite.mockResolvedValue({});
    Permission.find.mockResolvedValue(allPermissionDocs());
    Role.bulkWrite.mockResolvedValue({});
    Role.find.mockResolvedValue(allRoleDocs());
    User.updateMany.mockResolvedValue({ modifiedCount: 2 });
  });

  test("reports what it seeded", async () => {
    const result = await seedRbac();

    expect(result).toEqual({
      seeded: true,
      permissions: PERMISSION_DEFINITIONS.length,
      roles: ROLE_DEFINITIONS.length,
      usersBackfilled: 2,
    });
  });

  test("never throws when the database fails", async () => {
    // Seeding runs on boot — a failure must not stop the server starting.
    Permission.bulkWrite.mockRejectedValue(new Error("Mongo unreachable"));

    await expect(seedRbac()).resolves.toEqual(
      expect.objectContaining({ seeded: false, error: "Mongo unreachable" }),
    );
    expect(logger.error).toHaveBeenCalledWith("RBAC seed failed", {
      error: "Mongo unreachable",
    });
  });

  test("is safe to run repeatedly", async () => {
    const first = await seedRbac();
    const second = await seedRbac();

    expect(first.seeded).toBe(true);
    expect(second.seeded).toBe(true);
    expect(second.permissions).toBe(first.permissions);
    expect(second.roles).toBe(first.roles);
  });
});

describe("getDefaultRole", () => {
  beforeEach(() => jest.clearAllMocks());

  test("looks up the role by its canonical name", async () => {
    Role.findOne.mockResolvedValue({ _id: "role-SuperAdmin" });

    const role = await getDefaultRole();

    expect(Role.findOne).toHaveBeenCalledWith({ name: DEFAULT_ROLE });
    expect(role._id).toBe("role-SuperAdmin");
  });

  test("returns null rather than throwing when the lookup fails", async () => {
    Role.findOne.mockRejectedValue(new Error("Mongo unreachable"));

    await expect(getDefaultRole()).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  test("returns null when the role has not been seeded", async () => {
    Role.findOne.mockResolvedValue(null);

    await expect(getDefaultRole()).resolves.toBeNull();
  });
});
