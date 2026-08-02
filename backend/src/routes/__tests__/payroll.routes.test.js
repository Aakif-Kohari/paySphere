/**
 * Route-wiring regression coverage for #458.
 *
 * Two independent failures are asserted here, both of which were invisible to
 * the existing controller-level tests because they live entirely in the router:
 *
 *  1. The approval endpoints were implemented in the controller but never
 *     mounted, so the frontend 404'd on all three.
 *  2. `requirePermission` was imported but applied to `/parse-csv` only, so the
 *     read-only Employee role could finalize payroll, export salary data and
 *     dispatch payslip emails — re-opening what #413 closed.
 */

const express = require("express");
const request = require("supertest");

// Every handler is stubbed: this suite is about which middleware runs and in
// what order, not about what the controllers do.
jest.mock("../../controllers/payroll.controller", () => ({
  submitPayrollForReview: (req, res) => res.status(200).json({ ok: "finalize" }),
  parsePayrollCSV: (req, res) => res.status(200).json({ ok: "parse-csv" }),
  getPayrollSummary: (req, res) => res.status(200).json({ ok: "summary" }),
  exportPayrollCSV: (req, res) => res.status(200).json({ ok: "export-csv" }),
  sendPayslipEmailHandler: (req, res) => res.status(200).json({ ok: "send-email" }),
  sendAllPayslipsEmailHandler: (req, res) =>
    res.status(200).json({ ok: "send-all-emails" }),
  getPendingApprovals: (req, res) => res.status(200).json({ ok: "approvals" }),
  approvePayroll: (req, res) => res.status(200).json({ ok: "approve" }),
  rejectPayroll: (req, res) => res.status(200).json({ ok: "reject" }),
  markPayrollPaid: (req, res) => res.status(200).json({ ok: "mark-paid" }),
}));

jest.mock("../../middlewares/auth.middleware", () => (req, res, next) => {
  req.userId = "507f1f77bcf86cd799439011";
  next();
});

// Record which permission each route asked for, and honour a per-test grant set.
// Jest hoists jest.mock factories above the file body, so anything they close
// over must be prefixed `mock` to be exempt from the out-of-scope guard.
const mockGranted = new Set();
const mockRequestedPermissions = [];

jest.mock("../../middlewares/rbac.middleware", () => ({
  requirePermission: (permission) => (req, res, next) => {
    mockRequestedPermissions.push({ path: req.path, method: req.method, permission });
    if (!mockGranted.has(permission)) {
      return res
        .status(403)
        .json({ message: `Access denied. Requires permission: ${permission}` });
    }
    next();
  },
}));

jest.mock("../../middlewares/rateLimiter.middleware", () => ({
  writeRateLimiter: (req, res, next) => next(),
  generalRateLimiter: (req, res, next) => next(),
  authRateLimiter: (req, res, next) => next(),
}));

jest.mock("../../middlewares/upload.middleware", () => {
  const mw = { single: () => (req, res, next) => next() };
  mw.MAX_FILE_SIZE = 2 * 1024 * 1024;
  return mw;
});

const payrollRoutes = require("../payroll.routes");
const { PERMISSIONS } = require("../../config/permissions");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/payroll", payrollRoutes);
  return app;
};

const grantAll = () => {
  Object.values(PERMISSIONS).forEach((p) => mockGranted.add(p));
};

describe("payroll routes — the approval endpoints are mounted (#458)", () => {
  let app;

  beforeEach(() => {
    mockGranted.clear();
    mockRequestedPermissions.length = 0;
    grantAll();
    app = buildApp();
  });

  test("GET /approvals resolves instead of 404ing", async () => {
    const res = await request(app).get("/api/payroll/approvals");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe("approvals");
  });

  test("POST /approve resolves instead of 404ing", async () => {
    const res = await request(app).post("/api/payroll/approve").send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe("approve");
  });

  test("POST /reject resolves instead of 404ing", async () => {
    const res = await request(app).post("/api/payroll/reject").send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe("reject");
  });

  test("POST /mark-paid resolves — the terminal state was previously unreachable", async () => {
    const res = await request(app).post("/api/payroll/mark-paid").send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe("mark-paid");
  });

  test("the frontend's three Approvals.jsx calls all have a route", async () => {
    // Exactly the paths in frontend/src/pages/Approvals.jsx.
    const calls = [
      ["get", "/api/payroll/approvals"],
      ["post", "/api/payroll/approve"],
      ["post", "/api/payroll/reject"],
    ];

    for (const [method, path] of calls) {
      const res = await request(app)[method](path).send({});
      expect(res.status).not.toBe(404);
    }
  });
});

describe("payroll routes — RBAC guards are restored (#413, #458)", () => {
  let app;

  beforeEach(() => {
    mockGranted.clear();
    mockRequestedPermissions.length = 0;
    app = buildApp();
  });

  const writeRoutes = [
    ["post", "/api/payroll/finalize", PERMISSIONS.WRITE_PAYROLL],
    ["post", "/api/payroll/parse-csv", PERMISSIONS.WRITE_PAYROLL],
    ["post", "/api/payroll/send-email/507f1f77bcf86cd799439011", PERMISSIONS.WRITE_PAYROLL],
    ["post", "/api/payroll/send-all-emails", PERMISSIONS.WRITE_PAYROLL],
  ];

  const readRoutes = [
    ["get", "/api/payroll/summary", PERMISSIONS.READ_PAYROLL],
    ["get", "/api/payroll/export-csv", PERMISSIONS.READ_PAYROLL],
  ];

  const approvalRoutes = [
    ["get", "/api/payroll/approvals", PERMISSIONS.APPROVE_PAYROLL],
    ["post", "/api/payroll/approve", PERMISSIONS.APPROVE_PAYROLL],
    ["post", "/api/payroll/reject", PERMISSIONS.APPROVE_PAYROLL],
    ["post", "/api/payroll/mark-paid", PERMISSIONS.APPROVE_PAYROLL],
  ];

  const allRoutes = [...writeRoutes, ...readRoutes, ...approvalRoutes];

  test.each(allRoutes)(
    "%s %s is denied without %s",
    async (method, path, permission) => {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(403);
      expect(res.body.message).toContain(permission);
    },
  );

  test.each(allRoutes)(
    "%s %s is allowed with %s",
    async (method, path, permission) => {
      mockGranted.add(permission);
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(200);
    },
  );

  test("no payroll route runs on auth alone", async () => {
    // Nothing is granted, so every route must be refused by RBAC. If a route
    // were missing its guard it would fall through to the stubbed controller
    // and return 200 — exactly the regression #438 introduced.
    for (const [method, path] of allRoutes) {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(403);
    }
  });

  test("approval routes ask for APPROVE_PAYROLL, not WRITE_PAYROLL", async () => {
    // A maker–checker flow where the submitter's own permission also lets them
    // approve is decorative. The two must be separable.
    mockGranted.add(PERMISSIONS.WRITE_PAYROLL);

    for (const [method, path] of approvalRoutes) {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(403);
    }
  });

  test("APPROVE_PAYROLL alone does not unlock the write or read routes", async () => {
    mockGranted.add(PERMISSIONS.APPROVE_PAYROLL);

    for (const [method, path] of [...writeRoutes, ...readRoutes]) {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(403);
    }
  });
});

describe("payroll permissions vocabulary (#458)", () => {
  const { ROLE_DEFINITIONS, ROLES } = require("../../config/permissions");

  test("APPROVE_PAYROLL exists as a first-class permission", () => {
    expect(PERMISSIONS.APPROVE_PAYROLL).toBe("APPROVE_PAYROLL");
  });

  test("the owner role can approve", () => {
    const superAdmin = ROLE_DEFINITIONS.find((r) => r.name === ROLES.SUPER_ADMIN);
    expect(superAdmin.permissions).toContain(PERMISSIONS.APPROVE_PAYROLL);
  });

  test("the HR manager is the maker and cannot approve its own submissions", () => {
    const hr = ROLE_DEFINITIONS.find((r) => r.name === ROLES.HR_MANAGER);
    expect(hr.permissions).toContain(PERMISSIONS.WRITE_PAYROLL);
    expect(hr.permissions).not.toContain(PERMISSIONS.APPROVE_PAYROLL);
  });

  test("the read-only role holds neither write nor approve", () => {
    const employee = ROLE_DEFINITIONS.find((r) => r.name === ROLES.EMPLOYEE);
    expect(employee.permissions).not.toContain(PERMISSIONS.WRITE_PAYROLL);
    expect(employee.permissions).not.toContain(PERMISSIONS.APPROVE_PAYROLL);
  });
});
