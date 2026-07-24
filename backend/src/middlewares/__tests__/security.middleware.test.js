const request = require("supertest");
const app = require("../../app");

describe("Security Middleware - Helmet & CORS (#80)", () => {
  // ─── Helmet Security Headers ───────────────────────────────────

  describe("Helmet security headers", () => {
    test("should set X-Content-Type-Options to nosniff", async () => {
      const res = await request(app).get("/");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    test("should set X-Frame-Options to SAMEORIGIN", async () => {
      const res = await request(app).get("/");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    });

    test("should set Strict-Transport-Security header", async () => {
      const res = await request(app).get("/");
      expect(res.headers["strict-transport-security"]).toBeDefined();
    });

    test("should set X-XSS-Protection header", async () => {
      const res = await request(app).get("/");
      expect(res.headers["x-xss-protection"]).toBeDefined();
    });

    test("should set Referrer-Policy header", async () => {
      const res = await request(app).get("/");
      expect(res.headers["referrer-policy"]).toBeDefined();
    });

    test("should set Content-Security-Policy header", async () => {
      const res = await request(app).get("/");
      expect(res.headers["content-security-policy"]).toBeDefined();
    });
  });

  // ─── CORS Configuration ────────────────────────────────────────

  describe("CORS configuration", () => {
    const configuredOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

    test("should allow requests from the configured frontend origin", async () => {
      const res = await request(app)
        .get("/")
        .set("Origin", configuredOrigin);
      expect(res.headers["access-control-allow-origin"]).toBe(configuredOrigin);
    });

    test("should block requests from unconfigured origins", async () => {
      const res = await request(app)
        .get("/")
        .set("Origin", "https://evil.example.com");
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    test("should allow credentials when configured origin is used", async () => {
      const res = await request(app)
        .get("/")
        .set("Origin", configuredOrigin);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    test("should respond with 200 for allowed origin preflight", async () => {
      const res = await request(app)
        .options("/")
        .set("Origin", configuredOrigin)
        .set("Access-Control-Request-Method", "GET");
      expect(res.status).toBe(204);
    });
  });
});
