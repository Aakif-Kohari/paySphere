const { exportPayrollCSV } = require("../payroll.controller");
const PayrollUpdate = require("../../models/payroll.model");
const eventBus = require("../../services/event.service");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../../models/user.model");
jest.mock("../../services/email.service", () => ({
  sendPayslipEmail: jest.fn(),
}));
jest.mock("../../services/event.service", () => ({
  emit: jest.fn(),
  emitAuditLog: jest.fn(),
  on: jest.fn(),
}));
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

/** Mirrors the `.sort()`-chained query the controller issues. */
const createQueryMock = (data) => ({
  sort: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(data),
  then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
  catch: (reject) => Promise.resolve(data).catch(reject),
});

const samplePayrolls = [
  {
    _id: "p1",
    employeeName: "Alice Smith",
    baseSalary: 50000,
    leaveDays: 2,
    leaveDeduction: 3334,
    overtimeHours: 5,
    overtimePay: 1000,
    bonus: 2000,
    deductions: 500,
    netSalary: 49166,
    status: "finalized",
  },
  {
    _id: "p2",
    employeeName: "Bob Jones",
    baseSalary: 40000,
    leaveDays: 0,
    leaveDeduction: 0,
    overtimeHours: 10,
    overtimePay: 2000,
    bonus: 0,
    deductions: 1000,
    netSalary: 41000,
    status: "paid",
  },
];

describe("exportPayrollCSV — regression coverage for #412", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      userId: "507f1f77bcf86cd799439011",
      query: { month: "7", year: "2026" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  describe("the #412 regression itself", () => {
    test("does not throw ReferenceError and responds 200 with CSV", async () => {
      // `generatePayrollCSV` lives in utils/csvExport.js and was never imported
      // into payroll.controller.js, so this endpoint threw
      // `ReferenceError: generatePayrollCSV is not defined` on every call —
      // after validating input and hitting the database.
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );

      await exportPayrollCSV(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
    });

    test("sends a non-empty CSV body", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );

      await exportPayrollCSV(req, res, next);

      const body = res.send.mock.calls[0][0];
      expect(typeof body).toBe("string");
      expect(body.length).toBeGreaterThan(0);
    });

    test("never routes a successful export to the error handler", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );

      await exportPayrollCSV(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("response headers", () => {
    test("sets a text/csv content type", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );

      await exportPayrollCSV(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/csv; charset=utf-8",
      );
    });

    test("sets a download filename derived from the period", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );

      await exportPayrollCSV(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        "attachment; filename=payroll-7-2026.csv",
      );
    });
  });

  describe("CSV content", () => {
    beforeEach(() => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );
    });

    test("includes the header row", async () => {
      await exportPayrollCSV(req, res, next);
      const body = res.send.mock.calls[0][0];

      expect(body).toContain("Employee Name");
      expect(body).toContain("Base Salary");
      expect(body).toContain("Net Salary");
      expect(body).toContain("Status");
    });

    test("includes one row per payroll record", async () => {
      await exportPayrollCSV(req, res, next);
      const body = res.send.mock.calls[0][0];

      expect(body).toContain("Alice Smith");
      expect(body).toContain("Bob Jones");
      expect(body).toContain("49166");
      expect(body).toContain("41000");
    });

    test("appends the summary block with the period and total payout", async () => {
      await exportPayrollCSV(req, res, next);
      const body = res.send.mock.calls[0][0];

      expect(body).toContain("Month,Year,Total Employees,Total Payout");
      expect(body).toContain("7,2026,2,90166");
    });

    test("preserves the formula-injection escaping from the util (#273)", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock([
          { ...samplePayrolls[0], employeeName: "=cmd|'/c calc'!A1" },
        ]),
      );

      await exportPayrollCSV(req, res, next);
      const body = res.send.mock.calls[0][0];

      // Leading `=` must be neutralised so spreadsheet apps do not evaluate it.
      expect(body).not.toMatch(/^=cmd/m);
      expect(body).toContain("'=cmd");
    });
  });

  describe("period validation", () => {
    const invalidMonths = ["0", "13", "-1", "abc"];
    test.each(invalidMonths)("rejects month=%s with 400", async (month) => {
      req.query = { month, year: "2026" };

      await exportPayrollCSV(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "Invalid month parameter. Must be an integer between 1 and 12.",
      });
      expect(PayrollUpdate.find).not.toHaveBeenCalled();
    });

    const invalidYears = ["1999", "2101", "abc"];
    test.each(invalidYears)("rejects year=%s with 400", async (year) => {
      req.query = { month: "7", year };

      await exportPayrollCSV(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid year parameter. Must be a valid year integer.",
      });
    });

    test("truncates a fractional month via parseInt rather than rejecting it", async () => {
      // Documents existing behaviour: this handler parses with parseInt, so
      // "1.5" becomes month 1. finalizePayroll and getPayrollSummary use
      // Number() and would reject the same input. Harmless, but worth pinning
      // down so a future parser change is a deliberate one.
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );
      req.query = { month: "1.5", year: "2026" };

      await exportPayrollCSV(req, res, next);

      expect(PayrollUpdate.find).toHaveBeenCalledWith(
        expect.objectContaining({ month: 1 }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("accepts the boundary months 1 and 12", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );

      for (const month of ["1", "12"]) {
        jest.clearAllMocks();
        req.query = { month, year: "2026" };
        await exportPayrollCSV(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
      }
    });

    test("defaults to the current period when no query params are given", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );
      req.query = {};
      const now = new Date();

      await exportPayrollCSV(req, res, next);

      expect(PayrollUpdate.find).toHaveBeenCalledWith(
        expect.objectContaining({
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("scoping and empty results", () => {
    test("scopes the query to the authenticated user", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );

      await exportPayrollCSV(req, res, next);

      expect(PayrollUpdate.find).toHaveBeenCalledWith({
        createdBy: "507f1f77bcf86cd799439011",
        month: 7,
        year: 2026,
      });
    });

    test("returns 404 when the period has no payroll records", async () => {
      PayrollUpdate.find.mockImplementation(() => createQueryMock([]));

      await exportPayrollCSV(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "No payroll data found for the selected month.",
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    test("does not emit an audit event for an empty period", async () => {
      PayrollUpdate.find.mockImplementation(() => createQueryMock([]));

      await exportPayrollCSV(req, res, next);

      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    test("sorts records by employee name", async () => {
      const query = createQueryMock(samplePayrolls);
      PayrollUpdate.find.mockImplementation(() => query);

      await exportPayrollCSV(req, res, next);

      expect(query.sort).toHaveBeenCalledWith({ employeeName: 1 });
    });
  });

  describe("audit trail", () => {
    test("records a REPORT_DOWNLOAD event on a successful export", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );

      await exportPayrollCSV(req, res, next);

      expect(eventBus.emit).toHaveBeenCalledWith(
        "AUDIT_LOG",
        expect.objectContaining({
          userId: "507f1f77bcf86cd799439011",
          action: "REPORT_DOWNLOAD",
          resourceType: "Report",
          details: expect.objectContaining({
            month: 7,
            year: 2026,
            type: "payroll-csv",
            employeeCount: 2,
          }),
        }),
      );
    });

    test("emits the audit event after the response is sent", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock(samplePayrolls),
      );
      const order = [];
      res.send.mockImplementation(() => {
        order.push("send");
        return res;
      });
      eventBus.emit.mockImplementation(() => {
        order.push("audit");
        return true;
      });

      await exportPayrollCSV(req, res, next);

      expect(order).toEqual(["send", "audit"]);
    });
  });

  describe("data edge cases", () => {
    test("quotes an employee name containing a comma", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock([
          { ...samplePayrolls[0], employeeName: "Smith, Alice" },
        ]),
      );

      await exportPayrollCSV(req, res, next);
      const body = res.send.mock.calls[0][0];

      expect(body).toContain('"Smith, Alice"');
    });

    test("escapes embedded double quotes by doubling them", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock([
          { ...samplePayrolls[0], employeeName: 'Alice "Ace" Smith' },
        ]),
      );

      await exportPayrollCSV(req, res, next);
      const body = res.send.mock.calls[0][0];

      expect(body).toContain('"Alice ""Ace"" Smith"');
    });

    test("preserves non-ASCII employee names", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock([{ ...samplePayrolls[0], employeeName: "अंजली शर्मा" }]),
      );

      await exportPayrollCSV(req, res, next);
      const body = res.send.mock.calls[0][0];

      // The charset=utf-8 content type is what makes this survive in Excel.
      expect(body).toContain("अंजली शर्मा");
    });

    test("exports a period holding a single record", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock([samplePayrolls[0]]),
      );

      await exportPayrollCSV(req, res, next);
      const body = res.send.mock.calls[0][0];

      expect(res.status).toHaveBeenCalledWith(200);
      expect(body).toContain("7,2026,1,49166");
    });

    test("handles a large period without truncating rows", async () => {
      const many = Array.from({ length: 250 }, (_, i) => ({
        ...samplePayrolls[0],
        _id: `p${i}`,
        employeeName: `Employee ${i}`,
        netSalary: 1000,
      }));
      PayrollUpdate.find.mockImplementation(() => createQueryMock(many));

      await exportPayrollCSV(req, res, next);
      const body = res.send.mock.calls[0][0];

      expect(body).toContain("Employee 0");
      expect(body).toContain("Employee 249");
      expect(body).toContain("7,2026,250,250000");
    });

    test("reports the correct employee count in the audit event", async () => {
      PayrollUpdate.find.mockImplementation(() =>
        createQueryMock([samplePayrolls[0]]),
      );

      await exportPayrollCSV(req, res, next);

      expect(eventBus.emit).toHaveBeenCalledWith(
        "AUDIT_LOG",
        expect.objectContaining({
          details: expect.objectContaining({ employeeCount: 1 }),
        }),
      );
    });
  });

  describe("error handling", () => {
    test("forwards a database error to next()", async () => {
      const dbError = new Error("DB connection failed");
      PayrollUpdate.find.mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        then: (_resolve, reject) => Promise.reject(dbError).catch(reject),
        catch: (reject) => Promise.reject(dbError).catch(reject),
      }));

      await exportPayrollCSV(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
