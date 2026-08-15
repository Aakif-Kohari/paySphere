/**
 * @fileoverview Role Controller Tests
 * @description CRUD validation, system-role protection, name collisions and
 * audit emissions for the custom role endpoints (#475).
 */

jest.mock("../../models/role.model", () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const Role = jest.fn(function Role(doc) {
    Object.assign(this, doc);
    this._id = "role-1";
    this.save = save;
  });
  Role.find = jest.fn();
  Role.findById = jest.fn();
  Role.findOne = jest.fn();
  Role.deleteOne = jest.fn();
  Role.__save = save;
  return Role;
});
jest.mock("../../models/permission.model", () => ({ find: jest.fn() }));
jest.mock("../../models/user.model", () => ({
  aggregate: jest.fn(),
  countDocuments: jest.fn(),
}));
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
const Role = require("../../models/role.model");
const Permission = require("../../models/permission.model");
const User = require("../../models/user.model");
const eventBus = require("../../services/event.service");
const {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  isSystemRole,
  validateRoleName,
  resolvePermissions,
  SYSTEM_ROLE_NAMES,
} = require("../role.controller");
const { ROLES } = require("../../config/permissions");

const ROLE_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildReq = (body = {}, overrides = {}) => ({
  userId: USER_ID,
  body,
  params: { id: ROLE_ID },
  ip: "127.0.0.1",
  headers: {},
  next: jest.fn(),
  ...overrides,
});

// The handlers' third parameter is `next`; these wrappers hand each req its own
// mock so a stray error surfaces as a test failure instead of a crash.
const callWith = (handler) => (req, res) => handler(req, res, req.next);

const makeFindChain = (result) => {
  const chain = {
    sort: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    select: jest.fn(() => chain),
    lean: jest.fn(() => Promise.resolve(result)),
  };
  return chain;
};

// Mirror mongoose's `$in` behaviour so resolvePermissions sees only the names
// the caller asked for, not the whole catalog.
const mockPermissionFind = () => {
  Permission.find.mockImplementation((query = {}) => {
    const wanted = query.name && query.name.$in;
    const docs = wanted
      ? PERMISSION_DOCS.filter((d) => wanted.includes(d.name))
      : PERMISSION_DOCS;
    return makeFindChain(docs);
  });
};

const PERMISSION_DOCS = [
  { _id: "perm-READ_EMPLOYEE", name: "READ_EMPLOYEE", description: "View employees" },
  { _id: "perm-READ_PAYROLL", name: "READ_PAYROLL", description: "View payroll" },
  { _id: "perm-WRITE_PAYROLL", name: "WRITE_PAYROLL", description: "Write payroll" },
];

const makeRoleDoc = (overrides = {}) => ({
  _id: ROLE_ID,
  name: "Auditor",
  permissions: ["perm-READ_PAYROLL"],
  save: jest.fn().mockResolvedValue(undefined),
  toObject: function toObject() {
    return { ...this };
  },
  populate: function populate() {
    return makeFindChain({
      ...this,
      permissions: [
        { _id: "perm-READ_PAYROLL", name: "READ_PAYROLL", description: "View payroll" },
      ],
    });
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  Role.__save.mockResolvedValue(undefined);
});

describe("validation helpers", () => {
  test("validateRoleName accepts trimmed non-empty strings", () => {
    expect(validateRoleName("Auditor")).toEqual({ ok: true, name: "Auditor" });
    expect(validateRoleName("  Auditor  ")).toEqual({ ok: true, name: "Auditor" });
  });

  test("validateRoleName rejects empty, non-string and over-long names", () => {
    expect(validateRoleName("").ok).toBe(false);
    expect(validateRoleName("   ").ok).toBe(false);
    expect(validateRoleName(42).ok).toBe(false);
    expect(validateRoleName(undefined).ok).toBe(false);
    expect(validateRoleName("x".repeat(51)).ok).toBe(false);
  });

  test("isSystemRole flags the seeded roles", () => {
    expect(isSystemRole({ name: ROLES.SUPER_ADMIN })).toBe(true);
    expect(isSystemRole({ name: ROLES.HR_MANAGER })).toBe(true);
    expect(isSystemRole({ name: ROLES.EMPLOYEE })).toBe(true);
    expect(isSystemRole({ name: "Auditor" })).toBe(false);
    expect(isSystemRole(null)).toBe(false);
  });

  test("SYSTEM_ROLE_NAMES matches the seeded vocabulary", () => {
    expect(SYSTEM_ROLE_NAMES).toEqual(
      new Set([ROLES.SUPER_ADMIN, ROLES.HR_MANAGER, ROLES.EMPLOYEE]),
    );
  });

  test("resolvePermissions accepts only declared permission names", async () => {
    mockPermissionFind();

    const result = await resolvePermissions(["READ_PAYROLL", "WRITE_PAYROLL"]);

    expect(result.ok).toBe(true);
    const names = result.permissions.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["READ_PAYROLL", "WRITE_PAYROLL"]));
  });

  test("resolvePermissions rejects empty and unknown permission lists", async () => {
    mockPermissionFind();

    expect((await resolvePermissions([])).ok).toBe(false);
    expect((await resolvePermissions("READ_PAYROLL")).ok).toBe(false);
    expect((await resolvePermissions(undefined)).ok).toBe(false);

    const withUnknown = await resolvePermissions(["READ_PAYROLL", "NOT_A_PERM"]);
    expect(withUnknown.ok).toBe(false);
    expect(withUnknown.message).toContain("NOT_A_PERM");
  });
});

describe("getRoles", () => {
  const roleDocs = [
    { _id: "role-1", name: "Auditor", permissions: [], createdAt: null, updatedAt: null },
    { _id: "role-2", name: "SuperAdmin", permissions: [], createdAt: null, updatedAt: null },
  ];

  test("returns roles, permission catalog, system flag and user counts", async () => {
    Role.find.mockReturnValue(makeFindChain(roleDocs));
    mockPermissionFind();
    User.aggregate.mockResolvedValue([{ _id: "role-2", count: 4 }]);

    const req = buildReq();
    const res = buildRes();
    await callWith(getRoles)(req, res);

    expect(res.json).toHaveBeenCalledWith({
      roles: [
        { ...roleDocs[0], isSystem: false, userCount: 0 },
        { ...roleDocs[1], isSystem: true, userCount: 4 },
      ],
      permissions: PERMISSION_DOCS,
    });
  });

  test("handles an empty database", async () => {
    Role.find.mockReturnValue(makeFindChain([]));
    Permission.find.mockReturnValue(makeFindChain([]));
    User.aggregate.mockResolvedValue([]);

    const res = buildRes();
    await callWith(getRoles)(buildReq(), res);

    expect(res.json).toHaveBeenCalledWith({ roles: [], permissions: [] });
  });
});

describe("createRole", () => {
  test("creates a role, resolves names to ids, and emits an audit event", async () => {
    mockPermissionFind();
    Role.findOne.mockReturnValue(makeFindChain(null));

    const res = buildRes();
    await callWith(createRole)(
      buildReq({ name: "Auditor", permissions: ["READ_PAYROLL"] }),
      res,
    );

    expect(Role).toHaveBeenCalledWith({
      name: "Auditor",
      permissions: ["perm-READ_PAYROLL"],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(eventBus.emit).toHaveBeenCalledWith(
      "AUDIT_LOG",
      expect.objectContaining({
        action: "ROLE_CREATE",
        resourceType: "Role",
        resourceIds: ["role-1"],
        details: { name: "Auditor", permissions: ["READ_PAYROLL"] },
      }),
    );
  });

  test("rejects an invalid name", async () => {
    const res = buildRes();
    await callWith(createRole)(buildReq({ name: "", permissions: ["READ_PAYROLL"] }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Role).not.toHaveBeenCalled();
  });

  test("rejects a missing or unknown permission list", async () => {
    mockPermissionFind();

    const noPermissions = buildRes();
    await callWith(createRole)(buildReq({ name: "Auditor", permissions: [] }), noPermissions);
    expect(noPermissions.status).toHaveBeenCalledWith(400);

    const unknown = buildRes();
    await callWith(createRole)(
      buildReq({ name: "Auditor", permissions: ["NOT_A_PERM"] }),
      unknown,
    );
    expect(unknown.status).toHaveBeenCalledWith(400);
  });

  test("rejects a duplicate name with 409", async () => {
    mockPermissionFind();
    Role.findOne.mockReturnValue(makeFindChain({ _id: "other", name: "Auditor" }));

    const res = buildRes();
    await callWith(createRole)(buildReq({ name: "Auditor", permissions: ["READ_PAYROLL"] }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("already exists") }),
    );
  });

  test("maps a duplicate-key database error to 409", async () => {
    mockPermissionFind();
    Role.findOne.mockReturnValue(makeFindChain(null));
    Role.__save.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));

    const res = buildRes();
    await callWith(createRole)(buildReq({ name: "Auditor", permissions: ["READ_PAYROLL"] }), res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("updateRole", () => {
  test("updates name and permissions and emits an audit event", async () => {
    mockPermissionFind();
    const role = makeRoleDoc();
    Role.findById.mockReturnValue(role);
    Role.findOne.mockReturnValue(makeFindChain(null));

    const res = buildRes();
    const req = buildReq({
      name: "Senior Auditor",
      permissions: ["READ_PAYROLL", "WRITE_PAYROLL"],
    });
    await callWith(updateRole)(req, res);

    expect(role.name).toBe("Senior Auditor");
    expect(role.permissions).toEqual(["perm-READ_PAYROLL", "perm-WRITE_PAYROLL"]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(eventBus.emit).toHaveBeenCalledWith(
      "AUDIT_LOG",
      expect.objectContaining({ action: "ROLE_UPDATE", resourceType: "Role" }),
    );
  });

  test("rejects invalid id and missing roles", async () => {
    const badId = buildRes();
    await callWith(updateRole)(
      buildReq({}, { params: { id: "not-an-id" } }),
      badId,
    );
    expect(badId.status).toHaveBeenCalledWith(400);

    Role.findById.mockReturnValue(null);
    const missing = buildRes();
    await callWith(updateRole)(buildReq({ name: "Auditor" }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);
  });

  test("refuses to modify a system role", async () => {
    const role = makeRoleDoc({ name: ROLES.SUPER_ADMIN });
    Role.findById.mockReturnValue(role);

    const res = buildRes();
    await callWith(updateRole)(buildReq({ name: "Hacked" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  test("rejects a no-op update", async () => {
    Role.findById.mockReturnValue(makeRoleDoc());

    const res = buildRes();
    await callWith(updateRole)(buildReq({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("rejects renaming to a name another role already holds", async () => {
    mockPermissionFind();
    Role.findById.mockReturnValue(makeRoleDoc());
    Role.findOne.mockReturnValue(makeFindChain({ _id: "other", name: "Employee" }));

    const res = buildRes();
    await callWith(updateRole)(buildReq({ name: "Employee" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("deleteRole", () => {
  test("deletes a custom role and emits an audit event", async () => {
    Role.findById.mockReturnValue(makeRoleDoc());
    User.countDocuments.mockResolvedValue(0);
    Role.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const res = buildRes();
    await callWith(deleteRole)(buildReq(), res);

    expect(Role.deleteOne).toHaveBeenCalledWith({ _id: ROLE_ID });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(eventBus.emit).toHaveBeenCalledWith(
      "AUDIT_LOG",
      expect.objectContaining({ action: "ROLE_DELETE", resourceType: "Role" }),
    );
  });

  test("rejects invalid id and missing roles", async () => {
    const badId = buildRes();
    await callWith(deleteRole)(buildReq({}, { params: { id: "not-an-id" } }), badId);
    expect(badId.status).toHaveBeenCalledWith(400);

    Role.findById.mockReturnValue(null);
    const missing = buildRes();
    await callWith(deleteRole)(buildReq(), missing);
    expect(missing.status).toHaveBeenCalledWith(404);
  });

  test("refuses to delete a system role", async () => {
    Role.findById.mockReturnValue(makeRoleDoc({ name: ROLES.SUPER_ADMIN }));

    const res = buildRes();
    await callWith(deleteRole)(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Role.deleteOne).not.toHaveBeenCalled();
  });

  test("refuses to delete a role that is assigned to users", async () => {
    Role.findById.mockReturnValue(makeRoleDoc());
    User.countDocuments.mockResolvedValue(3);

    const res = buildRes();
    await callWith(deleteRole)(buildReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("3 user(s)") }),
    );
    expect(Role.deleteOne).not.toHaveBeenCalled();
  });
});
