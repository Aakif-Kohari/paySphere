const { deleteEmployee } = require("../employee.controller");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");

jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");

describe("Employee Controller - deleteEmployee (#345)", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: "emp123" },
      userId: "user123",
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  test("should return 404 if employee is not found", async () => {
    Employee.findById.mockResolvedValue(null);

    await deleteEmployee(req, res);

    expect(Employee.findById).toHaveBeenCalledWith("emp123");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Employee not found" });
  });

  test("should return 403 if user is not authorized to delete employee", async () => {
    const mockEmployee = {
      _id: "emp123",
      createdBy: "otherUser456",
    };
    Employee.findById.mockResolvedValue(mockEmployee);

    await deleteEmployee(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Not authorized to delete this employee",
    });
  });

  test("should block deletion and return 400 if employee has historical 'paid' payroll records", async () => {
    const mockEmployee = {
      _id: "emp123",
      createdBy: "user123",
    };
    Employee.findById.mockResolvedValue(mockEmployee);
    PayrollUpdate.exists.mockResolvedValue(true);

    await deleteEmployee(req, res);

    expect(PayrollUpdate.exists).toHaveBeenCalledWith({
      employeeId: "emp123",
      createdBy: "user123",
      status: "paid",
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Cannot delete employee with historical paid payroll records",
    });
    expect(PayrollUpdate.deleteMany).not.toHaveBeenCalled();
    expect(Employee.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test("should delete employee and unpaid payroll records if no 'paid' payroll records exist", async () => {
    const mockEmployee = {
      _id: "emp123",
      createdBy: "user123",
    };
    Employee.findById.mockResolvedValue(mockEmployee);
    PayrollUpdate.exists.mockResolvedValue(null);
    PayrollUpdate.deleteMany.mockResolvedValue({ deletedCount: 2 });
    Employee.findByIdAndDelete.mockResolvedValue(mockEmployee);

    await deleteEmployee(req, res);

    expect(PayrollUpdate.exists).toHaveBeenCalledWith({
      employeeId: "emp123",
      createdBy: "user123",
      status: "paid",
    });
    expect(PayrollUpdate.deleteMany).toHaveBeenCalledWith({
      employeeId: "emp123",
      createdBy: "user123",
    });
    expect(Employee.findByIdAndDelete).toHaveBeenCalledWith("emp123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Employee and payroll records deleted successfully",
    });
  });
});
