const { signup } = require("../user.controller");
const User = require("../../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../../utils/logger");
const { getDefaultRole } = require("../../seeds/rbac.seed");

jest.mock("bcryptjs");
jest.mock("jsonwebtoken");
jest.mock("axios");
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));
jest.mock("../../seeds/rbac.seed", () => ({
  getDefaultRole: jest.fn(),
}));
jest.mock("../../services/audit.service", () => ({
  createAuditLog: jest.fn(),
}));
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

let lastConstructed;
jest.mock("../../models/user.model", () => {
  const mockConstructor = jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    this._id = "new-user-id";
    this.save = jest.fn().mockResolvedValue(this);
    return this;
  });
  mockConstructor.findOne = jest.fn();
  mockConstructor.findById = jest.fn();
  return mockConstructor;
});

jest.mock("../../models/employee.model", () => ({ deleteMany: jest.fn() }));
jest.mock("../../models/payroll.model", () => ({ deleteMany: jest.fn() }));

describe("signup — RBAC role assignment (#413)", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {
        fullName: "Mohit Kourav",
        email: "owner@acme.com",
        companyName: "Acme Ltd",
        password: "StrongPass1!",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn(),
    };
    next = jest.fn();

    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashed_password");
    jwt.sign.mockReturnValue("signed_token");
    User.mockClear();
    User.mockImplementation(function (data) {
      Object.assign(this, data);
      this._id = "new-user-id";
      this.save = jest.fn().mockResolvedValue(this);
      lastConstructed = this;
      return this;
    });
  });

  test("attaches the default role to a newly registered account", async () => {
    // Before this fix nothing ever set `role`, so `requirePermission` denied the
    // brand-new account on every guarded route: the user could sign up and then
    // do nothing at all in the product.
    getDefaultRole.mockResolvedValue({ _id: "role-SuperAdmin" });

    await signup(req, res, next);

    expect(lastConstructed.role).toBe("role-SuperAdmin");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("resolves the role before constructing the user", async () => {
    getDefaultRole.mockResolvedValue({ _id: "role-SuperAdmin" });

    await signup(req, res, next);

    expect(getDefaultRole).toHaveBeenCalledTimes(1);
  });

  test("still creates the account when roles are not seeded", async () => {
    // Signup must not hard-fail on a seeding problem — the middleware repairs
    // the account on its next request.
    getDefaultRole.mockResolvedValue(null);

    await signup(req, res, next);

    expect(lastConstructed.role).toBeUndefined();
    expect(lastConstructed.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("warns when an account is created without a role", async () => {
    getDefaultRole.mockResolvedValue(null);

    await signup(req, res, next);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("without a role"),
      expect.objectContaining({ userId: "new-user-id" }),
    );
  });

  test("does not warn on the happy path", async () => {
    getDefaultRole.mockResolvedValue({ _id: "role-SuperAdmin" });

    await signup(req, res, next);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("does not look up a role when validation rejects the request", async () => {
    req.body.password = "weak";

    await signup(req, res, next);

    expect(getDefaultRole).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("does not look up a role when the email is already registered", async () => {
    User.findOne.mockResolvedValue({ _id: "existing" });

    await signup(req, res, next);

    expect(getDefaultRole).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("still stores the normalized email and hashed password", async () => {
    getDefaultRole.mockResolvedValue({ _id: "role-SuperAdmin" });
    req.body.email = "  OWNER@Acme.com  ";

    await signup(req, res, next);

    expect(lastConstructed.email).toBe("owner@acme.com");
    expect(lastConstructed.password).toBe("hashed_password");
  });
});
