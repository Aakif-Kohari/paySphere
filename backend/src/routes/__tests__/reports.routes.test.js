jest.mock("../../middlewares/auth.middleware", () => jest.fn());
jest.mock("../../middlewares/rbac.middleware", () => ({
  requirePermission: jest.fn(() => jest.fn()),
}));
jest.mock("../../controllers/reports.controller", () => ({
  getAnalytics: jest.fn(),
  downloadPDFReport: jest.fn(),
  exportExcelReport: jest.fn(),
  downloadPayslipsZip: jest.fn(),
}));

const router = require("../reports.routes");
const { requirePermission } = require("../../middlewares/rbac.middleware");
const auth = require("../../middlewares/auth.middleware");
const controller = require("../../controllers/reports.controller");

/** Flatten the express router stack into { path, methods, handlers }. */
const registeredRoutes = () =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      handlers: layer.route.stack.map((s) => s.handle),
    }));

describe("reports.routes — orphaned endpoints from #334 (#415)", () => {
  describe("route registration", () => {
    test("registers /export-xlsx", () => {
      // exportExcelReport was implemented in full and imported into this file,
      // but never routed — GET /api/reports/export-xlsx fell through to the
      // 404 handler, so the feature was unreachable dead code.
      const route = registeredRoutes().find((r) => r.path === "/export-xlsx");

      expect(route).toBeDefined();
      expect(route.methods).toEqual(["get"]);
    });

    test("registers /download-zip", () => {
      const route = registeredRoutes().find((r) => r.path === "/download-zip");

      expect(route).toBeDefined();
      expect(route.methods).toEqual(["get"]);
    });

    test("keeps the two routes that already worked", () => {
      const paths = registeredRoutes().map((r) => r.path);

      expect(paths).toContain("/analytics");
      expect(paths).toContain("/download-pdf");
    });

    test("registers exactly the four report endpoints", () => {
      const paths = registeredRoutes().map((r) => r.path).sort();

      expect(paths).toEqual([
        "/analytics",
        "/download-pdf",
        "/download-zip",
        "/export-xlsx",
      ]);
    });

    test("every imported controller is reachable", () => {
      // The `no-unused-vars` ESLint errors on this file were the visible symptom
      // of the bug: an imported handler with no route.
      const handlers = registeredRoutes().flatMap((r) => r.handlers);

      expect(handlers).toContain(controller.getAnalytics);
      expect(handlers).toContain(controller.downloadPDFReport);
      expect(handlers).toContain(controller.exportExcelReport);
      expect(handlers).toContain(controller.downloadPayslipsZip);
    });
  });

  describe("middleware", () => {
    test("the new routes require authentication", () => {
      for (const path of ["/export-xlsx", "/download-zip"]) {
        const route = registeredRoutes().find((r) => r.path === path);
        expect(route.handlers).toContain(auth);
      }
    });

    test("the new routes are permission-guarded like their siblings", () => {
      // requirePermission is called once per route at module load.
      expect(requirePermission).toHaveBeenCalledWith("READ_REPORT");
      expect(requirePermission).toHaveBeenCalledTimes(4);
    });

    test("each route runs auth, then a permission check, then the handler", () => {
      for (const route of registeredRoutes()) {
        expect(route.handlers).toHaveLength(3);
        expect(route.handlers[0]).toBe(auth);
      }
    });
  });
});
