const User = require("../../models/user.model");
const logger = require("../../utils/logger");
const { getDefaultRole } = require("../../seeds/rbac.seed");

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

describe("requirePermission", () => {
  let req;
  let res;
  let next;
  let requirePermission;

  const loadMiddleware = () => {
    jest.isolateModules(() => {
      ({ requirePermission } = require("../rbac.middleware"));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RBAC_STRICT;
    loadMiddleware();

    req = { userId: "user123" };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
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
    test("lets the request through and logs loudly when no default role exists", async () => {
      // Denying here would re-create the exact outage this issue reports.
      // Controllers already scope every query by createdBy: req.userId.
      getDefaultRole.mockResolvedValue(null);
      mockFindById({ _id: "user123", role: null });

      await requirePermission("READ_EMPLOYEE")(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Permission check bypassed"),
        expect.objectContaining({ requiredPermission: "READ_EMPLOYEE" }),
      );
    });

    test("denies instead when RBAC_STRICT=true", async () => {
      process.env.RBAC_STRICT = "true";
      loadMiddleware();

      getDefaultRole.mockResolvedValue(null);
      mockFindById({ _id: "user123", role: null });

      await requirePermission("READ_EMPLOYEE")(req, res, next);

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
