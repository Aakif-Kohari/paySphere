const User = require("../../models/user.model");
const logger = require("../../utils/logger");
const { getDefaultRole } = require("../../seeds/rbac.seed");
const authorize = require("../rbac.middleware");
// Every `requirePermission` suite below has been in this file since #413, but
// this import was lost in a merge — so all 20 of them failed with
// `ReferenceError: requirePermission is not defined` and the RBAC regressions
// silently stopped guarding anything (#558).
const { requirePermission } = require("../rbac.middleware");

jest.mock("../../models/user.model");
jest.mock("../../seeds/rbac.seed", () => ({
  getDefaultRole: jest.fn(),
}));
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

/** Mirrors the chained `.populate()` the middleware calls. */
const mockFindById = (user) => {
  User.findById.mockReturnValue({
    populate: jest.fn().mockResolvedValue(user),
  });
};

const buildRole = (name, permissionNames) => ({
  _id: `role-${name}`,
  name,
  permissions: permissionNames.map((n) => ({ _id: `perm-${n}`, name: n })),
});

const SUPER_ADMIN = () =>
  buildRole("SuperAdmin", [
    "READ_EMPLOYEE",
    "WRITE_EMPLOYEE",
    "DELETE_EMPLOYEE",
    "READ_PAYROLL",
    "WRITE_PAYROLL",
    "READ_REPORT",
  ]);

describe('authorize middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('should return 401 if user is not attached to request', () => {
    req.user = null;
    const middleware = authorize('EMPLOYEE');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 if user account type is not authorized', () => {
    req.user = { accountType: 'EMPLOYEE' };
    const middleware = authorize('ADMIN');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied. Insufficient permissions.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next() if user account type is allowed', () => {
    req.user = { accountType: 'EMPLOYEE' };
    const middleware = authorize('EMPLOYEE', 'ADMIN');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('prefers the account type the auth middleware already resolved', () => {
    req.accountType = 'EMPLOYEE';
    req.user = { accountType: 'ADMIN' };
    const middleware = authorize('EMPLOYEE');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('treats an unlinked account as the owner', () => {
    req.user = {};
    const middleware = authorize('ADMIN');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('treats an account linked to an employee record as an employee', () => {
    // The pre-#558 fallback read `req.user.role || "ADMIN"` and would have let
    // this through an ADMIN-only route.
    req.user = { employeeId: 'emp-1' };
    const middleware = authorize('ADMIN');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('does not treat an RBAC role reference as an account type', () => {
    // `role` holds an ObjectId now. The old guard compared it against
    // "ADMIN"/"EMPLOYEE" and fell back to "ADMIN" when it did not match, so an
    // employee login with a role reference was handed the owner console.
    req.user = { role: '68f3ac1e5b2d4c0012ab34cd', employeeId: 'emp-1' };
    const middleware = authorize('ADMIN');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('lets any signed-in account through when no type is required', () => {
    req.user = { accountType: 'EMPLOYEE' };
    const middleware = authorize();
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("requirePermission", () => {
  // These suites used to lean on the `req/res/next` declared inside the
  // `authorize` describe above, which is out of scope here — the other half of
  // what the merge broke.
  let req, res, next;

  let originalNodeEnv;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RBAC_STRICT;
    process.env.NODE_ENV = originalNodeEnv;

    req = { userId: "user123" };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe("authentication guard", () => {
    test("returns 401 when auth middleware has not run", async () => {
      req = {};

      await requirePermission("READ_EMPLOYEE")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Authentication required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 404 when the user no longer exists", async () => {
      mockFindById(null);

      await requirePermission("READ_EMPLOYEE")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });
  });

  describe("granting access", () => {
    test("calls next() when the role holds the permission", async () => {
      mockFindById({ _id: "user123", role: SUPER_ADMIN() });

      await requirePermission("WRITE_EMPLOYEE")(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("exposes the resolved role name on the request", async () => {
      mockFindById({ _id: "user123", role: SUPER_ADMIN() });

      await requirePermission("READ_REPORT")(req, res, next);

      expect(req.userRole).toBe("SuperAdmin");
    });

    test("grants every permission SuperAdmin is seeded with", async () => {
      const permissions = [
        "READ_EMPLOYEE",
        "WRITE_EMPLOYEE",
        "DELETE_EMPLOYEE",
        "READ_PAYROLL",
        "WRITE_PAYROLL",
        "READ_REPORT",
      ];

      for (const permission of permissions) {
        jest.clearAllMocks();
        mockFindById({ _id: "user123", role: SUPER_ADMIN() });
        const localNext = jest.fn();

        await requirePermission(permission)(req, res, localNext);

        expect(localNext).toHaveBeenCalled();
      }
    });
  });

  describe("denying access", () => {
    test("returns 403 when the role lacks the permission", async () => {
      const readOnly = buildRole("Employee", [
        "READ_EMPLOYEE",
        "READ_PAYROLL",
      ]);
      mockFindById({ _id: "user123", role: readOnly });

      await requirePermission("DELETE_EMPLOYEE")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied. Requires permission: DELETE_EMPLOYEE",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("HRManager cannot delete employees but can run payroll", async () => {
      const hrManager = buildRole("HRManager", [
        "READ_EMPLOYEE",
        "WRITE_EMPLOYEE",
        "READ_PAYROLL",
        "WRITE_PAYROLL",
        "READ_REPORT",
      ]);

      mockFindById({ _id: "user123", role: hrManager });
      await requirePermission("WRITE_PAYROLL")(req, res, next);
      expect(next).toHaveBeenCalled();

      jest.clearAllMocks();
      mockFindById({ _id: "user123", role: hrManager });
      const denyNext = jest.fn();
      await requirePermission("DELETE_EMPLOYEE")(req, res, denyNext);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(denyNext).not.toHaveBeenCalled();
    });

    test("logs the denial with the role and required permission", async () => {
      mockFindById({
        _id: "user123",
        role: buildRole("Employee", ["READ_EMPLOYEE"]),
      });

      await requirePermission("WRITE_PAYROLL")(req, res, next);

      expect(logger.warn).toHaveBeenCalledWith(
        "Permission denied",
        expect.objectContaining({
          userId: "user123",
          role: "Employee",
          requiredPermission: "WRITE_PAYROLL",
        }),
      );
    });
  });

  describe("accounts with no role — the #413 lockout", () => {
    test("repairs the account and lets the request through", async () => {
      // Before this fix, `!user.role` was true for *every* account (nothing ever
      // assigned one) and this returned 403, making the whole employee and
      // report surface unreachable for every user of the application.
      const defaultRole = { _id: "role-SuperAdmin", name: "SuperAdmin" };
      getDefaultRole.mockResolvedValue(defaultRole);

      User.findById
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue({ _id: "user123", role: null }),
        })
        .mockReturnValueOnce({
          populate: jest
            .fn()
            .mockResolvedValue({ _id: "user123", role: SUPER_ADMIN() }),
        });
      User.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await requirePermission("READ_EMPLOYEE")(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("persists the repair so it only happens once", async () => {
      const defaultRole = { _id: "role-SuperAdmin", name: "SuperAdmin" };
      getDefaultRole.mockResolvedValue(defaultRole);

      User.findById
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue({ _id: "user123" }),
        })
        .mockReturnValueOnce({
          populate: jest
            .fn()
            .mockResolvedValue({ _id: "user123", role: SUPER_ADMIN() }),
        });
      User.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await requirePermission("READ_EMPLOYEE")(req, res, next);

      expect(User.updateOne).toHaveBeenCalledWith(
        { _id: "user123" },
        { $set: { role: "role-SuperAdmin" } },
      );
    });

    test("still enforces permissions after the repair", async () => {
      const defaultRole = { _id: "role-Employee", name: "Employee" };
      getDefaultRole.mockResolvedValue(defaultRole);

      User.findById
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue({ _id: "user123", role: null }),
        })
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue({
            _id: "user123",
            role: buildRole("Employee", ["READ_EMPLOYEE"]),
          }),
        });
      User.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await requirePermission("DELETE_EMPLOYEE")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("unseeded database", () => {
    test("lets the request through and logs loudly when no default role exists in development", async () => {
      // In development mode, we bypass check if default role does not exist
      process.env.NODE_ENV = "development";
      let devRequirePermission;
      let DevUser;
      let devGetDefaultRole;

      jest.isolateModules(() => {
        DevUser = require("../../models/user.model");
        ({ getDefaultRole: devGetDefaultRole } = require("../../seeds/rbac.seed"));
        ({ requirePermission: devRequirePermission } = require("../rbac.middleware"));
      });

      devGetDefaultRole.mockResolvedValue(null);
      DevUser.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: "user123", role: null }),
      });

      await devRequirePermission("READ_EMPLOYEE")(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Permission check bypassed"),
        expect.objectContaining({ requiredPermission: "READ_EMPLOYEE" }),
      );
    });

    test("denies instead when RBAC_STRICT=true", async () => {
      // STRICT_MODE is read from the environment once, at require time, so the
      // middleware has to be loaded again with the flag set. `isolateModules`
      // gives it a fresh registry; the mocks declared at the top of this file
      // still apply, but they are *new* mock objects, so the doubles have to be
      // re-fetched from inside the isolated scope.
      process.env.RBAC_STRICT = "true";

      let strictRequirePermission;
      let StrictUser;
      let strictGetDefaultRole;

      jest.isolateModules(() => {
        StrictUser = require("../../models/user.model");
        ({ getDefaultRole: strictGetDefaultRole } = require("../../seeds/rbac.seed"));
        ({ requirePermission: strictRequirePermission } = require("../rbac.middleware"));
      });

      strictGetDefaultRole.mockResolvedValue(null);
      StrictUser.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: "user123", role: null }),
      });

      await strictRequirePermission("READ_EMPLOYEE")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied. No role assigned.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("denies by default in non-development environments", async () => {
      process.env.NODE_ENV = "test";
      delete process.env.RBAC_STRICT;

      let testRequirePermission;
      let TestUser;
      let testGetDefaultRole;

      jest.isolateModules(() => {
        TestUser = require("../../models/user.model");
        ({ getDefaultRole: testGetDefaultRole } = require("../../seeds/rbac.seed"));
        ({ requirePermission: testRequirePermission } = require("../rbac.middleware"));
      });

      testGetDefaultRole.mockResolvedValue(null);
      TestUser.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({ _id: "user123", role: null }),
      });

      await testRequirePermission("READ_EMPLOYEE")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Access denied. No role assigned.",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    test("returns 500 when the lookup throws", async () => {
      User.findById.mockImplementation(() => {
        throw new Error("DB exploded");
      });

      await requirePermission("READ_EMPLOYEE")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Internal server error during authorization check",
      });
    });

    test("logs the failure rather than swallowing it", async () => {
      User.findById.mockImplementation(() => {
        throw new Error("DB exploded");
      });

      await requirePermission("READ_EMPLOYEE")(req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        "RBAC middleware error",
        expect.objectContaining({ error: "DB exploded" }),
      );
    });

    test("tolerates a role whose permission array contains nulls", async () => {
      // A dangling ObjectId reference populates as null.
      mockFindById({
        _id: "user123",
        role: { _id: "r1", name: "SuperAdmin", permissions: [null, undefined] },
      });

      await requirePermission("READ_EMPLOYEE")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
