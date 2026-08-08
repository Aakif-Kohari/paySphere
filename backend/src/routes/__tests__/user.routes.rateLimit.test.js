/**
 * Route-wiring regression coverage for #470.
 *
 * The auth rate limiter (`authRateLimiter`) was already wired onto `/login` and
 * `/reset-password`, but nothing exercised it end-to-end: the controller tests
 * bypass the router and the other route suites stub the limiter away with a
 * pass-through. This suite mounts the *real* limiter on the *real* router and
 * proves a hostile client eventually gets a 429 on every sensitive auth route —
 * including the 2FA endpoints, which were previously unguarded.
 */

const express = require("express");
const request = require("supertest");

// Every handler is stubbed: this suite is about which middleware runs and in
// what order, not about what the controllers do.
jest.mock("../../controllers/user.controller", () => ({
  signup: (req, res) => res.status(200).json({ ok: true }),
  login: (req, res) => res.status(200).json({ ok: true }),
  googleAuth: (req, res) => res.status(200).json({ ok: true }),
  forgotPassword: (req, res) => res.status(200).json({ ok: true }),
  resetPassword: (req, res) => res.status(200).json({ ok: true }),
  refresh: (req, res) => res.status(200).json({ ok: true }),
  logout: (req, res) => res.status(200).json({ ok: true }),
  getSettings: (req, res) => res.status(200).json({ ok: true }),
  updateSettings: (req, res) => res.status(200).json({ ok: true }),
  updatePassword: (req, res) => res.status(200).json({ ok: true }),
  disconnectGoogle: (req, res) => res.status(200).json({ ok: true }),
  deleteAccount: (req, res) => res.status(200).json({ ok: true }),
  generate2FA: (req, res) => res.status(200).json({ ok: true }),
  verifyAndEnable2FA: (req, res) => res.status(200).json({ ok: true }),
  disable2FA: (req, res) => res.status(200).json({ ok: true }),
  validate2FALogin: (req, res) => res.status(200).json({ ok: true }),
}));

jest.mock("../../middlewares/auth.middleware", () => (req, res, next) => {
  req.userId = "507f1f77bcf86cd799439011";
  next();
});

// Force the default limit so the blocked-request count below is deterministic
// regardless of any AUTH_RATE_LIMIT in the host environment.
delete process.env.AUTH_RATE_LIMIT;

const userRoutes = require("../user.routes");

const buildApp = () => {
  const app = express();
  // `trust proxy` is set on the real app (app.js) so client IPs come from
  // X-Forwarded-For; mirror that here so each test gets an isolated key.
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/auth", userRoutes);
  return app;
};

// Hammer a route from a unique client IP until the auth limiter blocks us, and
// return the last response. A legitimate burst (well under the 30/15-min limit)
// is asserted separately, so this only ever trips after the limit is hit.
const hammerUntilBlocked = async (app, path, payload) => {
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  let response = null;
  for (let i = 0; i < 40; i += 1) {
    response = await request(app)
      .post(path)
      .set("X-Forwarded-For", ip)
      .send(payload);
    if (response.status === 429) break;
  }
  return response;
};

describe("auth routes are rate limited (#470)", () => {
  it("blocks /api/auth/login with 429 after the auth limit", async () => {
    const app = buildApp();
    const response = await hammerUntilBlocked(app, "/api/auth/login", {
      email: "user@example.com",
      password: "wrong-password",
    });
    expect(response.status).toBe(429);
  });

  it("blocks /api/auth/reset-password/:token with 429 after the auth limit", async () => {
    const app = buildApp();
    const response = await hammerUntilBlocked(app, "/api/auth/reset-password/abc123", {
      newPassword: "NewPass123!",
    });
    expect(response.status).toBe(429);
  });

  it("blocks /api/auth/2fa/validate-login with 429 after the auth limit", async () => {
    const app = buildApp();
    const response = await hammerUntilBlocked(app, "/api/auth/2fa/validate-login", {
      code: "123456",
    });
    expect(response.status).toBe(429);
  });

  it("blocks /api/auth/2fa/generate and /2fa/verify-and-enable with 429 after the auth limit", async () => {
    const app = buildApp();
    const generate = await hammerUntilBlocked(app, "/api/auth/2fa/generate", {});
    const verify = await hammerUntilBlocked(app, "/api/auth/2fa/verify-and-enable", {
      code: "123456",
    });
    expect(generate.status).toBe(429);
    expect(verify.status).toBe(429);
  });

  it("returns the documented message body on a 429", async () => {
    const app = buildApp();
    const response = await hammerUntilBlocked(app, "/api/auth/login", {
      email: "user@example.com",
      password: "wrong-password",
    });
    expect(response.status).toBe(429);
    expect(response.body.message).toMatch(/Too many authentication attempts/i);
  });

  it("does not block legitimate users below the limit", async () => {
    const app = buildApp();
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    for (let i = 0; i < 3; i += 1) {
      const response = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", ip)
        .send({ email: "user@example.com", password: "wrong-password" });
      expect(response.status).toBe(200);
    }
  });
});
