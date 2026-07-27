const { updateEmployee } = require("../employee.controller");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");

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
