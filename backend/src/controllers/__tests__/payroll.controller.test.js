const { finalizePayroll } = require("../payroll.controller");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");
const User = require("../../models/user.model");
const mongoose = require("mongoose");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../../models/user.model");
jest.mock("../../services/audit.service", () => ({
  createAuditLog: jest.fn(),
}));

describe("Payroll Controller - finalizePayroll parseTagValue & Transactions Unit Tests (#106)", () => {
  let req, res, mockSession;

  beforeEach(() => {
    req = {
      userId: "507f1f77bcf86cd799439011",
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should default unparseable tags like 'deduction' without a number to 0 instead of NaN", async () => {
    const mockEmployee = {
      _id: "emp1",
      fullName: "Alice Smith",
      monthlySalary: 50000,
      overtimeRate: 200,
      isActive: true,
    };
    Employee.find.mockResolvedValue([mockEmployee]);
    User.findById.mockResolvedValue({ defaultDailyRate: 0, defaultOvertimeRate: 0 });

    PayrollUpdate.bulkWrite.mockResolvedValue({});
    PayrollUpdate.find
      .mockResolvedValueOnce([]) // Guard query — no existing paid records
      .mockResolvedValueOnce([   // Phase 3 query — return created payroll
        {
          _id: "payroll1",
          employeeId: "emp1",
        }
      ]);

    req.body = {
      activities: [
        {
          employeeId: "507f1f77bcf86cd799439011",
          name: "Alice Smith",
          tags: [
            { label: "deduction" }, // unparseable tag value
            { label: "leave" },     // unparseable tag value
            { label: "bonus 500" }, // valid parsed tag value 500
          ],
        },
      ],
      month: 7,
      year: 2026,
    };

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.results).toHaveLength(1);

    const result = jsonCall.results[0];
    expect(result.deductions).toBe(0);
    expect(result.leaveDays).toBe(0);
    expect(result.bonus).toBe(500);
    expect(isNaN(result.netSalary)).toBe(false);
    expect(result.netSalary).toBe(50500);
  });
});

describe("finalizePayroll month/year validation tests (#79)", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      userId: "507f1f77bcf86cd799439011",
      body: {
        activities: [
          {
            employeeId: "emp123",
            name: "John Doe",
            tags: [],
          },
        ],
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test("should return 400 if month is out of range (13)", async () => {
    req.body.month = 13;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if month is a float (5.5)", async () => {
    req.body.month = 5.5;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if month is 0 (not silently fall back to current month)", async () => {
    req.body.month = 0;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if month is negative", async () => {
    req.body.month = -5;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid month. Must be an integer between 1 and 12",
    });
  });

  test("should return 400 if year is out of range (1999)", async () => {
    req.body.year = 1999;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid year. Must be a valid year integer",
    });
  });

  test("should return 400 if year is a float (2024.5)", async () => {
    req.body.year = 2024.5;

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid year. Must be a valid year integer",
    });
  });
});

describe("finalizePayroll paid-record guard (#251)", () => {
  let req, res, mockEmployees, mockUserSettings, mockSession;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);

    mockEmployees = [
      {
        _id: "emp1",
        fullName: "Alice Smith",
        monthlySalary: 50000,
        overtimeRate: 200,
        isActive: true,
      },
      {
        _id: "emp2",
        fullName: "Bob Jones",
        monthlySalary: 60000,
        overtimeRate: 250,
        isActive: true,
      },
    ];

    mockUserSettings = { defaultDailyRate: 0, defaultOvertimeRate: 0 };

    req = {
      userId: "user123",
      body: {
        activities: [
          {
            employeeId: "emp1",
            name: "Alice Smith",
            tags: [],
          },
          {
            employeeId: "emp2",
            name: "Bob Jones",
            tags: [],
          },
        ],
        month: 7,
        year: 2026,
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    Employee.find.mockResolvedValue(mockEmployees);
    User.findById.mockResolvedValue(mockUserSettings);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should return 400 when paid payroll records exist for the same month/year", async () => {
    PayrollUpdate.find
      .mockResolvedValueOnce([
        { employeeName: "Alice Smith", status: "paid" },
        { employeeName: "Bob Jones", status: "paid" },
      ]);

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Payroll has already been paid for: Alice Smith, Bob Jones. Cannot re-finalize paid records.",
      paidEmployees: ["Alice Smith", "Bob Jones"],
    });
    expect(PayrollUpdate.bulkWrite).not.toHaveBeenCalled();
  });

  test("should succeed when some employees have no payroll records yet", async () => {
    PayrollUpdate.find
      .mockResolvedValueOnce([]) // Guard — no paid records
      .mockResolvedValueOnce([   // Phase 3
        { _id: "payroll1", employeeId: "emp1" },
        { _id: "payroll2", employeeId: "emp2" },
      ]);

    PayrollUpdate.bulkWrite.mockResolvedValue({});

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.results).toHaveLength(2);
  });

  test("should succeed when existing payroll records have status 'finalized' (not 'paid')", async () => {
    PayrollUpdate.find
      .mockResolvedValueOnce([]) // Guard — no paid records (only 'finalized' ones exist)
      .mockResolvedValueOnce([   // Phase 3
        { _id: "payroll1", employeeId: "emp1" },
        { _id: "payroll2", employeeId: "emp2" },
      ]);

    PayrollUpdate.bulkWrite.mockResolvedValue({});

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.results).toHaveLength(2);
  });

  test("should still validate activity data before paid-record guard", async () => {
    // No guard check needed — validation happens first
    req.body.activities = [];

    await finalizePayroll(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No activities to process",
    });
    // Guard's find should never be called since validation fails first
    expect(PayrollUpdate.find).not.toHaveBeenCalled();
  });
});
