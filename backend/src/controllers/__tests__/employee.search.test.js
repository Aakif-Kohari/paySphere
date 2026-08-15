const { getEmployees } = require("../employee.controller");
const Employee = require("../../models/employee.model");

jest.mock("../../models/employee.model");

describe("Employee Controller - getEmployees search and filter", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: "user123",
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test("should fetch employees with default pagination and filters", async () => {
    const mockEmployees = [
      { _id: "e1", fullName: "Alice Smith", role: "Manager" },
      { _id: "e2", fullName: "Bob Jones", role: "Developer" },
    ];
    Employee.countDocuments.mockResolvedValue(2);
    Employee.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockEmployees),
    });

    await getEmployees(req, res, next);

    expect(Employee.countDocuments).toHaveBeenCalledWith({
      createdBy: "user123",
      deletedAt: null,
      isActive: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      employees: mockEmployees,
      currentPage: 1,
      totalPages: 1,
      totalEmployees: 2,
    });
  });

  test("should filter employees by general search query", async () => {
    req.query = { search: "Alice" };
    Employee.countDocuments.mockResolvedValue(1);
    Employee.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ _id: "e1", fullName: "Alice Smith", role: "Manager" }]),
    });

    await getEmployees(req, res, next);

    expect(Employee.countDocuments).toHaveBeenCalledWith({
      createdBy: "user123",
      deletedAt: null,
      isActive: true,
      $and: [
        {
          $or: [
            { fullName: { $regex: "Alice", $options: "i" } },
            { role: { $regex: "Alice", $options: "i" } },
          ],
        },
      ],
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should filter employees by role query parameter", async () => {
    req.query = { role: "Developer" };
    Employee.countDocuments.mockResolvedValue(1);
    Employee.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ _id: "e2", fullName: "Bob Jones", role: "Developer" }]),
    });

    await getEmployees(req, res, next);

    expect(Employee.countDocuments).toHaveBeenCalledWith({
      createdBy: "user123",
      deletedAt: null,
      isActive: true,
      $and: [
        { role: { $regex: "Developer", $options: "i" } },
      ],
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("should combine search and role filter query parameters", async () => {
    req.query = { search: "Bob", role: "Developer" };
    Employee.countDocuments.mockResolvedValue(1);
    Employee.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ _id: "e2", fullName: "Bob Jones", role: "Developer" }]),
    });

    await getEmployees(req, res, next);

    expect(Employee.countDocuments).toHaveBeenCalledWith({
      createdBy: "user123",
      deletedAt: null,
      isActive: true,
      $and: [
        {
          $or: [
            { fullName: { $regex: "Bob", $options: "i" } },
            { role: { $regex: "Bob", $options: "i" } },
          ],
        },
        { role: { $regex: "Developer", $options: "i" } },
      ],
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
