const request = require("supertest");
const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../../models/user.model");
const zxcvbn = require("../../utils/zxcvbn");
const userController = require("../user.controller");

// Setup a small mock express app to test the controller actions
const app = express();
app.use(express.json());

// Mock auth middleware for settings change
app.use((req, res, next) => {
  req.userId = "60c72b2f9b1d8e2528cf5611"; // Mocked user ID
  next();
});

app.post("/signup", userController.signup);
app.patch("/password", userController.changePassword);

jest.mock("../../utils/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../seeds/rbac.seed", () => ({
  getDefaultRole: jest.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId() }),
}));

describe("Password Security & History (#827)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("zxcvbn Password Entropy Utility", () => {
    it("assigns score 0-1 to simple/weak passwords", () => {
      expect(zxcvbn("123").score).toBeLessThan(3);
      expect(zxcvbn("password").score).toBeLessThan(3);
      expect(zxcvbn("qwerty123").score).toBeLessThan(3);
    });

    it("assigns score >= 3 to strong passwords with upper, lower, numbers, and symbols", () => {
      expect(zxcvbn("P@ssw0rd2026!").score).toBeGreaterThanOrEqual(3);
      expect(zxcvbn("ComplexStr0ng#Password").score).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Signup Password Complexity Enforcement", () => {
    it("rejects weak passwords on signup", async () => {
      const spyFind = jest.spyOn(User, "findOne").mockResolvedValue(null);
      
      const res = await request(app)
        .post("/signup")
        .send({
          fullName: "Security Tester",
          email: "tester@paysphere.com",
          companyName: "Tester Co",
          password: "weak",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Password is too weak");
      spyFind.mockRestore();
    });
  });

  describe("Password History & Reuse Prevention", () => {
    it("rejects password reuse matching the last 5 passwords", async () => {
      const mockUser = {
        _id: "60c72b2f9b1d8e2528cf5611",
        password: await bcrypt.hash("OldSecureP@ss1", 12),
        passwordHistory: [
          await bcrypt.hash("OldSecureP@ss1", 12),
          await bcrypt.hash("OldSecureP@ss2", 12),
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      const spyFindById = jest.spyOn(User, "findById").mockResolvedValue(mockUser);

      const res = await request(app)
        .patch("/password")
        .send({
          currentPassword: "OldSecureP@ss1",
          newPassword: "OldSecureP@ss2", // Attempting reuse
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("reuse any of your last 5 passwords");
      spyFindById.mockRestore();
    });

    it("accepts a strong, unique new password and stores it in history", async () => {
      const initialHistory = [
        await bcrypt.hash("OldSecureP@ss1", 12),
        await bcrypt.hash("OldSecureP@ss2", 12),
      ];

      const mockUser = {
        _id: "60c72b2f9b1d8e2528cf5611",
        password: await bcrypt.hash("OldSecureP@ss1", 12),
        passwordHistory: [...initialHistory],
        save: jest.fn().mockImplementation(function() {
          return Promise.resolve(this);
        }),
      };

      const spyFindById = jest.spyOn(User, "findById").mockResolvedValue(mockUser);

      const res = await request(app)
        .patch("/password")
        .send({
          currentPassword: "OldSecureP@ss1",
          newPassword: "BrandNewSecureP@ss3!", // Complex and unique
        });

      expect(res.status).toBe(200);
      expect(mockUser.passwordHistory.length).toBe(3); // New password appended
      spyFindById.mockRestore();
    });

    it("limits password history size to 5", async () => {
      const initialHistory = [
        await bcrypt.hash("P@ss1", 12),
        await bcrypt.hash("P@ss2", 12),
        await bcrypt.hash("P@ss3", 12),
        await bcrypt.hash("P@ss4", 12),
        await bcrypt.hash("P@ss5", 12),
      ];

      const mockUser = {
        _id: "60c72b2f9b1d8e2528cf5611",
        password: await bcrypt.hash("CurrentP@ss6!", 12),
        passwordHistory: [...initialHistory],
        save: jest.fn().mockImplementation(function() {
          return Promise.resolve(this);
        }),
      };

      const spyFindById = jest.spyOn(User, "findById").mockResolvedValue(mockUser);

      const res = await request(app)
        .patch("/password")
        .send({
          currentPassword: "CurrentP@ss6!",
          newPassword: "BrandNewUniqueP@ss7!",
        });

      expect(res.status).toBe(200);
      expect(mockUser.passwordHistory.length).toBe(5); // Retains exactly 5
      spyFindById.mockRestore();
    });
  });
});
