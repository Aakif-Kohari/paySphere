const User = require("../../models/user.model");
const Tenant = require("../../models/tenant.model");
const Role = require("../../models/role.model");
const Employee = require("../../models/employee.model");
const PayrollUpdate = require("../../models/payroll.model");
const { seedDevDatabase } = require("../devSeeder");

jest.mock("../../models/user.model");
jest.mock("../../models/tenant.model");
jest.mock("../../models/role.model");
jest.mock("../../models/employee.model");
jest.mock("../../models/payroll.model");
jest.mock("../rbac.seed", () => ({
  seedRbac: jest.fn().mockResolvedValue({ seeded: true }),
}));

jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("Developer Database Seeder Script (#728)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("successfully seeds roles, admin user, tenant, 500+ employees, and historical payroll records", async () => {
    const mockRoleId = "60c72b2f9b1d8e2528cf5600";
    const mockUserId = "60c72b2f9b1d8e2528cf5611";
    const mockTenantId = "60c72b2f9b1d8e2528cf5622";

    // Mock DB queries
    Role.findOne.mockResolvedValue({ _id: mockRoleId, name: "Owner" });
    
    const mockAdmin = {
      _id: mockUserId,
      fullName: "Dev Administrator",
      email: "dev-admin@paysphere.com",
      tenantId: mockTenantId,
      save: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(mockAdmin);

    const mockTenant = {
      _id: mockTenantId,
      name: "PaySphere Dev Tenant",
      ownerId: mockUserId,
      save: jest.fn().mockResolvedValue(true),
    };
    Tenant.findOne.mockResolvedValue(mockTenant);

    Employee.deleteMany.mockResolvedValue({ deletedCount: 520 });
    PayrollUpdate.deleteMany.mockResolvedValue({ deletedCount: 1560 });

    // Mock 520 inserted employees
    const mockInsertedEmployees = Array.from({ length: 520 }, (_, idx) => ({
      _id: `emp-id-${idx}`,
      fullName: `Employee Name ${idx}`,
      monthlySalary: 50000,
      overtimeRate: 200,
    }));
    Employee.insertMany.mockResolvedValue(mockInsertedEmployees);

    PayrollUpdate.insertMany.mockResolvedValue(true);

    // Run the seeder
    const result = await seedDevDatabase();

    expect(result.success).toBe(true);
    expect(result.employeesCount).toBe(520);
    expect(result.payrollsCount).toBe(1560); // 520 employees * 3 months

    // Verify clear calls
    expect(Employee.deleteMany).toHaveBeenCalled();
    expect(PayrollUpdate.deleteMany).toHaveBeenCalled();

    // Verify insertions
    expect(Employee.insertMany).toHaveBeenCalled();
    expect(PayrollUpdate.insertMany).toHaveBeenCalled();
  });
});
