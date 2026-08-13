const cacheService = require("../../services/cache.service");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");
const User = require("../../models/user.model");
const mongoose = require("mongoose");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../../models/user.model");
// Read once per employee in a run, to bundle anything owed from a backdated
// salary revision (#931). Mocked as a factory rather than automocked so the
// query never reaches Mongoose: unmocked, it buffers against a database this
// suite never connects to and every test in the file times out (#950).
jest.mock('../../models/arrearsLedger.model', () => ({
  find: jest.fn(() => ({
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  })),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  insertMany: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../services/event.service", () => ({
  emit: jest.fn(),
  emitAuditLog: jest.fn(),
  on: jest.fn(),
}));
jest.mock("../../services/email.service", () => ({
  sendPayslipEmail: jest.fn(),
}));
jest.mock("../../services/cache.service", () => ({
  invalidateAnalytics: jest.fn().mockResolvedValue(true),
  invalidateDashboardSummary: jest.fn().mockResolvedValue(true),
  invalidatePattern: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
}));
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

// submitPayrollForReview now consults the attendance ledger (#459).
jest.mock("../../models/attendance.model", () => ({
  find: jest.fn(() => ({ select: jest.fn().mockResolvedValue([]) })),
}));

// deleteEmployee now refuses to destroy an employee with a settled F&F, the
// same protection #345 added for paid payroll (#462). Stubbed so the employee
// unit tests stay free of the settlement collection; the guard has its own
// coverage in settlement.controller.test.js.
jest.mock("../../models/settlement.model", () => ({
  exists: jest.fn().mockResolvedValue(null),
}));

// submitPayrollForReview now recovers loan instalments (#460). Stubbed so the
// payroll unit tests stay free of the loan collection; recovery behaviour is
// covered in payroll.loans.test.js.
jest.mock("../../models/loan.model", () => ({
  find: jest.fn().mockResolvedValue([]),
  updateOne: jest.fn().mockResolvedValue({}),
}));

// submitPayrollForReview now snapshots the salary component breakdown (#461).
// Stubbed so the payroll unit tests stay free of the structure collection;
// resolution is covered in salaryStructure.test.js.
jest.mock("../../models/salaryStructure.model", () => ({
  find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([]) })),
}));

// submitPayrollForReview now reimburses approved expense claims (#719).
jest.mock("../../models/expenseClaim.model", () => ({
  find: jest.fn(() => ({
    populate: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue([]),
    })),
  })),
}));

const { submitPayrollForReview } = require("../payroll.controller");
const {
  deleteEmployee,
  toggleEmployeeStatus,
} = require("../employee.controller");

const createQueryMock = (data) => ({
  sort: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(data),
  then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
  catch: (reject) => Promise.resolve(data).catch(reject),
});

// The company. A different value from the user id on purpose: since #613 the
// scope is the tenant, not the account that created the row.
const TENANT = "507f1f77bcf86cd799439098";
const OTHER_TENANT = "507f1f77bcf86cd799439097";

describe("analytics cache invalidation (#415)", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe("submitPayrollForReview", () => {
    const employee = {
      _id: "emp-1",
      fullName: "Alice Smith",
      monthlySalary: 50000,
      overtimeRate: 200,
      isActive: true,
    };

    beforeEach(() => {
      req = {
        userId: "user123",
        body: {
          month: 7,
          year: 2026,
          activities: [
            { employeeId: "emp-1", tags: [{ label: "5 hours overtime" }] },
          ],
        },
      };

      jest.spyOn(mongoose, "startSession").mockResolvedValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      });

      Employee.find.mockResolvedValue([employee]);
      User.findById.mockResolvedValue({
        defaultDailyRate: 0,
        defaultOvertimeRate: 0,
      });
      PayrollUpdate.bulkWrite.mockResolvedValue({});
      PayrollUpdate.find
        .mockImplementationOnce(() => createQueryMock([]))
        .mockImplementation(() =>
          createQueryMock([{ _id: "payroll-1", employeeId: "emp-1" }]),
        );
    });

    afterEach(() => jest.restoreAllMocks());

    test("invalidates the analytics cache after a successful run", async () => {
      // This was the mutation that mattered most and the one that never cleared
      // the cache: run payroll, open Reports, see the previous month's totals
      // for up to an hour.
      await submitPayrollForReview(req, res, next);

      expect(cacheService.invalidateAnalytics).toHaveBeenCalledWith("user123");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("invalidates exactly once", async () => {
      await submitPayrollForReview(req, res, next);

      expect(cacheService.invalidateAnalytics).toHaveBeenCalledTimes(1);
    });

    test("does not invalidate when validation rejects the request", async () => {
      req.body.activities = [];

      await submitPayrollForReview(req, res, next);

      expect(cacheService.invalidateAnalytics).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("does not invalidate when the period is already paid", async () => {
      PayrollUpdate.find.mockReset();
      PayrollUpdate.find.mockImplementationOnce(() =>
        createQueryMock([{ employeeName: "Alice Smith", status: "paid" }]),
      );

      await submitPayrollForReview(req, res, next);

      expect(cacheService.invalidateAnalytics).not.toHaveBeenCalled();
      // 409 since #458: the request is well formed, it is the record's state
      // that forbids re-submitting it.
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe("deleteEmployee", () => {
    const validId = "507f1f77bcf86cd799439011";
    beforeEach(() => {
      req = { userId: "user123", tenantId: TENANT, params: { id: validId } };
      Employee.findById.mockResolvedValue({
        _id: validId,
        fullName: "Alice Smith",
        role: "Designer",
        createdBy: { toString: () => "user123" },
        tenantId: { toString: () => TENANT },
        // deleteEmployee soft-deletes via `employee.save()` since #445; the
        // fixture still described the findByIdAndDelete era, so the save threw
        // and the cache was never invalidated.
        deletedAt: null,
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      });
      Employee.findByIdAndDelete.mockResolvedValue({});
      PayrollUpdate.exists.mockResolvedValue(false);
      PayrollUpdate.deleteMany.mockResolvedValue({});
      jest.spyOn(mongoose, "startSession").mockResolvedValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      });
    });

    afterEach(() => jest.restoreAllMocks());

    test("invalidates the analytics cache", async () => {
      await deleteEmployee(req, res, next);

      expect(cacheService.invalidateAnalytics).toHaveBeenCalledWith("user123");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("does not invalidate when the employee is not found", async () => {
      Employee.findById.mockResolvedValue(null);

      await deleteEmployee(req, res, next);

      expect(cacheService.invalidateAnalytics).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("does not invalidate when the caller does not own the employee", async () => {
      Employee.findById.mockResolvedValue({
        _id: validId,
        createdBy: { toString: () => "someone-else" },
        tenantId: { toString: () => OTHER_TENANT },
      });

      await deleteEmployee(req, res, next);

      expect(cacheService.invalidateAnalytics).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("does not invalidate when deletion is blocked by paid payroll", async () => {
      PayrollUpdate.exists.mockResolvedValue(true);

      await deleteEmployee(req, res, next);

      expect(cacheService.invalidateAnalytics).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("toggleEmployeeStatus", () => {
    let employee;
    const validId = "507f1f77bcf86cd799439011";

    beforeEach(() => {
      req = { userId: "user123", tenantId: TENANT, params: { id: validId } };
      employee = {
        _id: validId,
        fullName: "Alice Smith",
        isActive: true,
        createdBy: { toString: () => "user123" },
        tenantId: { toString: () => TENANT },
        save: jest.fn().mockResolvedValue(true),
      };
      Employee.findById.mockResolvedValue(employee);
    });

    test("invalidates the analytics cache", async () => {
      // Inactive employees are excluded from payroll (#260), so the toggle
      // changes the aggregates.
      await toggleEmployeeStatus(req, res, next);

      expect(cacheService.invalidateAnalytics).toHaveBeenCalledWith("user123");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("flips the flag and persists it", async () => {
      await toggleEmployeeStatus(req, res, next);

      expect(employee.isActive).toBe(false);
      expect(employee.save).toHaveBeenCalled();
    });

    test("emits the audit event it was previously missing", async () => {
      const eventBus = require("../../services/event.service");

      await toggleEmployeeStatus(req, res, next);

      expect(eventBus.emit).toHaveBeenCalledWith(
        "AUDIT_LOG",
        expect.objectContaining({
          userId: "user123",
          action: "EMPLOYEE_STATUS_TOGGLE",
          resourceType: "Employee",
          details: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    test("does not invalidate when the caller does not own the employee", async () => {
      employee.tenantId = { toString: () => OTHER_TENANT };

      await toggleEmployeeStatus(req, res, next);

      expect(cacheService.invalidateAnalytics).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
