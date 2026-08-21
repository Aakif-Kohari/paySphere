const { calculateRetroactivePay } = require('../retroactiveCalculator');
const { createAdjustment, getAdjustments } = require('../../controllers/salaryAdjustment.controller');
const PayrollUpdate = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');
const SalaryHistory = require('../../models/salaryHistory.model');
const { SalaryAdjustment } = require('../../models/salaryAdjustment.model');

// Mock models
jest.mock('../../models/payroll.model', () => {
  const mockFind = jest.fn();
  return {
    find: mockFind,
  };
});

jest.mock('../../models/employee.model', () => {
  const mockFindOne = jest.fn();
  return {
    findOne: mockFindOne,
  };
});

jest.mock('../../models/salaryHistory.model', () => {
  const mockCreate = jest.fn();
  return {
    create: mockCreate,
  };
});

jest.mock('../../models/salaryAdjustment.model', () => {
  const mockCreate = jest.fn();
  const mockFind = jest.fn();
  return {
    SalaryAdjustment: {
      create: mockCreate,
      find: mockFind,
    },
  };
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Retroactive Pay Adjustment Engine (#1242)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calculateRetroactivePay should compute total deltas since effective date', async () => {
    const employeeId = 'emp123';
    const tenantId = 'tenant123';

    // Mock employee with old salary 4000
    Employee.findOne.mockResolvedValueOnce({
      _id: employeeId,
      monthlySalary: 4000,
      fullName: 'Jane Doe',
    });

    // Mock past approved payroll runs:
    // Aug 2026: baseSalary 4000
    // Sep 2026: baseSalary 4000
    PayrollUpdate.find.mockReturnValue({
      sort: jest.fn().mockResolvedValueOnce([
        { month: 8, year: 2026, baseSalary: 4000 },
        { month: 9, year: 2026, baseSalary: 4000 },
      ]),
    });

    // New rate is 4500 (delta is 500 per month for 2 months = 1000 total)
    const result = await calculateRetroactivePay(employeeId, tenantId, 8, 2026, 4500);

    expect(result.totalDelta).toBe(1000);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0]).toEqual({
      month: 8,
      year: 2026,
      paid: 4000,
      expected: 4500,
      delta: 500,
    });
  });

  test('createAdjustment should update salary rates and insert history audit logs', async () => {
    const employeeId = 'emp123';
    const tenantId = 'tenant123';

    const mockEmployee = {
      _id: employeeId,
      fullName: 'Jane Doe',
      monthlySalary: 4000,
      save: jest.fn().mockResolvedValue(true),
    };

    Employee.findOne.mockResolvedValueOnce(mockEmployee);

    PayrollUpdate.find.mockReturnValue({
      sort: jest.fn().mockResolvedValueOnce([
        { month: 8, year: 2026, baseSalary: 4000 },
      ]),
    });

    SalaryAdjustment.create.mockImplementationOnce(data => data);
    SalaryHistory.create.mockResolvedValueOnce(true);

    const req = {
      tenantId,
      userId: 'admin123',
      user: { fullName: 'HR Admin' },
      body: {
        employeeId,
        effectiveMonth: 8,
        effectiveYear: 2026,
        newSalaryRate: 4500,
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await createAdjustment(req, res, next);

    // Should recalculate delta
    expect(SalaryAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        employeeId,
        calculatedDelta: 500,
        newSalaryRate: 4500,
        status: 'Pending',
      })
    );

    // Should update employee
    expect(mockEmployee.monthlySalary).toBe(4500);
    expect(mockEmployee.save).toHaveBeenCalled();

    // Should log history
    expect(SalaryHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        previousSalary: 4000,
        newSalary: 4500,
        salaryChange: 500,
      })
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });
});
