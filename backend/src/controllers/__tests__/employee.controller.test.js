const { updateEmployee, importEmployees } = require("../employee.controller");
const Employee = require("../../models/employee.model");
const User = require("../../models/user.model");
const mongoose = require("mongoose");

jest.mock("../../models/employee.model");
jest.mock("../../models/user.model");

// Mock csv-parse so we can assert on options passed
jest.mock("csv-parse", () => ({ parse: jest.fn() }));
const { parse: mockParse } = require("csv-parse");

// ---- Direct csv-parse BOM tests (real parser) ----
// These verify that the `bom: true` option actually strips UTF-8 BOM headers.
// They use jest.requireActual to bypass the mock and test the real csv-parse.
describe("csv-parse BOM behavior", () => {
  test("bom: true strips UTF-8 BOM from header names", async () => {
    const { parse } = jest.requireActual("csv-parse");
    const csv = "\ufefffullName,role,monthlySalary\nJohn Doe,Developer,50000";

    const records = await new Promise((resolve, reject) => {
      parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true }, (err, r) => {
        if (err) reject(err); else resolve(r);
      });
    });

    expect(Object.keys(records[0])[0]).toBe("fullName");
    expect(records[0].fullName).toBe("John Doe");
  });

  test("bom: true works with CSV that has no BOM (no regression)", async () => {
    const { parse } = jest.requireActual("csv-parse");
    const csv = "fullName,role,monthlySalary\nJohn Doe,Developer,50000";

    const records = await new Promise((resolve, reject) => {
      parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true }, (err, r) => {
        if (err) reject(err); else resolve(r);
      });
    });

    expect(Object.keys(records[0])[0]).toBe("fullName");
    expect(records[0].fullName).toBe("John Doe");
  });
});

// ---- importEmployees tests ----
describe("Employee Controller - importEmployees", () => {
  let req, res, next, mockSession;

  beforeEach(() => {
    req = {
      userId: "user123",
      file: { buffer: Buffer.from("dummy"), originalname: "employees.csv" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);
    User.findById.mockResolvedValue({ _id: "user123", companyName: "Acme Corp" });
    // Employee.find().select() chain: mock find to return an object with select()
    Employee.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
    Employee.insertMany.mockResolvedValue([{ _id: "emp1" }]);

    // Default mockParse: call callback synchronously with mock records
    mockParse.mockImplementation((_data, _options, callback) => {
      callback(null, [
        { fullName: "John Doe", role: "Developer", monthlySalary: "50000", overtimeRate: "100" },
      ]);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should pass bom: true option to csv-parse", async () => {
    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockParse).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ bom: true }),
      expect.any(Function),
    );
  });

  test("should import employees successfully from CSV", async () => {
    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Employee import completed" }),
    );
  });

  test("should return 400 when no CSV file is uploaded", async () => {
    req.file = undefined;

    await importEmployees(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No CSV file uploaded" });
  });

  test("should return 404 when user not found", async () => {
    User.findById.mockResolvedValue(null);

    await importEmployees(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
  });

  test("should skip rows with missing required fields", async () => {
    mockParse.mockImplementation((_data, _options, callback) => {
      callback(null, [
        { fullName: "", role: "Dev", monthlySalary: "50000", overtimeRate: "100" },
        { fullName: "Jane", role: "", monthlySalary: "60000", overtimeRate: "50" },
      ]);
    });

    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        skipped: expect.any(Number),
        errors: expect.arrayContaining([
          expect.objectContaining({ reason: "Full name is required" }),
          expect.objectContaining({ reason: "Role is required" }),
        ]),
      }),
    );
  });

  test("should skip duplicate employees (same name and role)", async () => {
    Employee.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        { fullName: "John Doe", role: "Developer" },
      ]),
    });

    importEmployees(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ reason: expect.stringMatching(/duplicate/i) }),
        ]),
      }),
    );
  });
});

describe("Employee Controller - updateEmployee", () => {
  let req, res, next, employeeDoc;

  beforeEach(() => {
    employeeDoc = {
      _id: "emp1",
      createdBy: { toString: () => "user123" },
      fullName: "Old Name",
      monthlySalary: 30000,
      overtimeRate: 100,
      save: jest.fn().mockResolvedValue(true),
    };

    req = {
      params: { id: "emp1" },
      userId: "user123",
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    Employee.findById.mockResolvedValue(employeeDoc);
  });

  test("should reject non-finite monthlySalary (e.g. Infinity)", async () => {
    req.body = { monthlySalary: Infinity };

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(employeeDoc.save).not.toHaveBeenCalled();
  });

  test("should reject non-finite overtimeRate (e.g. Infinity)", async () => {
    req.body = { overtimeRate: Infinity };

    await updateEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(employeeDoc.save).not.toHaveBeenCalled();
  });

  test("should accept a valid finite monthlySalary", async () => {
    req.body = { monthlySalary: 35000 };

    await updateEmployee(req, res, next);

    expect(employeeDoc.monthlySalary).toBe(35000);
    expect(employeeDoc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("Employee Controller - updateEmployee name propagation to PayrollUpdate (#253)", () => {
  let req, res, next, employeeDoc;

  beforeEach(() => {
    employeeDoc = {
      _id: "emp1",
      createdBy: { toString: () => "user123" },
      fullName: "Original Name",
      role: "Engineer",
      monthlySalary: 30000,
      overtimeRate: 100,
      save: jest.fn().mockResolvedValue(true),
    };

    req = {
      params: { id: "emp1" },
      userId: "user123",
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    Employee.findById.mockResolvedValue(employeeDoc);
    PayrollUpdate.updateMany.mockResolvedValue({ modifiedCount: 3 });
  });

  test("should propagate fullName change to finalized PayrollUpdate records", async () => {
    req.body = { fullName: "New Name" };

    await updateEmployee(req, res, next);

    expect(employeeDoc.fullName).toBe("New Name");
    expect(PayrollUpdate.updateMany).toHaveBeenCalledWith(
      { employeeId: "emp1", createdBy: "user123", status: "finalized" },
      { $set: { employeeName: "New Name" } }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should not propagate when fullName is unchanged", async () => {
    req.body = { fullName: "Original Name" };

    await updateEmployee(req, res, next);

    // SanitizeText on "Original Name" equals "Original Name" which equals oldName
    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should not propagate when fullName is not provided (other field update)", async () => {
    req.body = { monthlySalary: 50000 };

    await updateEmployee(req, res, next);

    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should not propagate when fullName is empty string (validation fails first)", async () => {
    req.body = { fullName: "" };

    await updateEmployee(req, res, next);

    expect(employeeDoc.save).not.toHaveBeenCalled();
    expect(PayrollUpdate.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("should still propagate when only name changes alongside other fields", async () => {
    req.body = { fullName: "New Name", monthlySalary: 50000, role: "Senior Engineer" };

    await updateEmployee(req, res, next);

    expect(employeeDoc.fullName).toBe("New Name");
    expect(employeeDoc.role).toBe("Senior Engineer");
    expect(employeeDoc.monthlySalary).toBe(50000);
    expect(PayrollUpdate.updateMany).toHaveBeenCalledWith(
      { employeeId: "emp1", createdBy: "user123", status: "finalized" },
      { $set: { employeeName: "New Name" } }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
