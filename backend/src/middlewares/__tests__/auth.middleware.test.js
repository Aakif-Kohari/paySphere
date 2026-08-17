const jwt = require("jsonwebtoken");
const auth = require("../auth.middleware");
const User = require("../../models/user.model");

jest.mock("../../models/user.model");
jest.mock("jsonwebtoken");

describe("Auth Middleware Unit Tests", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test("should return 401 if no authorization header is provided", async () => {
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if token is invalid", async () => {
    req.headers.authorization = "Bearer invalidtoken";
    jwt.verify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if user does not exist in database", async () => {
    req.headers.authorization = "Bearer validtoken";
    jwt.verify.mockReturnValue({ id: "user123", tokenVersion: 0 });

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await auth(req, res, next);
    expect(User.findById).toHaveBeenCalledWith("user123");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found or deactivated" });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if user isActive is false", async () => {
    req.headers.authorization = "Bearer validtoken";
    jwt.verify.mockReturnValue({ id: "user123", tokenVersion: 0 });

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "user123", isActive: false, tokenVersion: 0 }),
    });

    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found or deactivated" });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if tokenVersion does not match", async () => {
    req.headers.authorization = "Bearer validtoken";
    jwt.verify.mockReturnValue({ id: "user123", tokenVersion: 0 });

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "user123", isActive: true, tokenVersion: 1 }),
    });

    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token is no longer valid" });
    expect(next).not.toHaveBeenCalled();
  });

  test("should set req.userId and req.user and call next() for a valid active user", async () => {
    req.headers.authorization = "Bearer validtoken";
    const decoded = { id: "user123", tokenVersion: 0 };
    jwt.verify.mockReturnValue(decoded);

    const dbUser = { _id: "user123", isActive: true, tokenVersion: 0 };
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(dbUser),
    });

    await auth(req, res, next);
    expect(req.userId).toBe("user123");
    expect(req.user).toEqual(dbUser);
    expect(next).toHaveBeenCalled();
  });
});
