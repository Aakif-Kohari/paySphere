const { updateEmployee } = require("../employee.controller");
const Employee = require("../../models/employee.model");

jest.mock("../../models/employee.model");

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
