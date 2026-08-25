const pensionCalculator = require('../pensionCalculator');
const { createPolicy, getPolicies, getEmployeePensionSetting, updateEmployeePensionSetting } = require('../../controllers/pension.controller');
const { PensionPolicy, EmployeePensionSetting } = require('../../models/pensionPolicy.model');
const Employee = require('../../models/employee.model');

// Mock models
jest.mock('../../models/pensionPolicy.model', () => {
  const mockFind = jest.fn();
  const mockFindOne = jest.fn();
  const mockCreate = jest.fn();
  const mockFindOneAndUpdate = jest.fn();
  return {
    PensionPolicy: {
      find: mockFind,
      findOne: mockFindOne,
      create: mockCreate,
    },
    EmployeePensionSetting: {
      findOne: mockFindOne,
      create: mockCreate,
      findOneAndUpdate: mockFindOneAndUpdate,
    },
  };
});

jest.mock('../../models/employee.model', () => {
  const mockFindById = jest.fn();
  const mockFindOne = jest.fn();
  return {
    findById: mockFindById,
    findOne: mockFindOne,
  };
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Auto-Enrolment and Pension Contribution Calculator (#1241)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calculatePensionContribution should compute correct employee and employer portions under salary caps', async () => {
    const employeeId = 'emp123';
    const tenantId = 'tenant123';

    // Mock India PF policy: 12% employee, 12% employer, cap INR 15,000
    const mockPolicy = {
      _id: 'policyPF',
      planName: 'Provident Fund',
      employeeContributionRate: 12,
      employerContributionRate: 12,
      monthlySalaryCap: 15000,
    };

    const mockSetting = {
      isEnrolled: true,
      pensionPolicyId: mockPolicy,
      customEmployeeContributionRate: null,
      customEmployerContributionRate: null,
    };

    EmployeePensionSetting.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValueOnce(mockSetting),
    });

    // Case A: baseSalary 20,000 (exceeds cap, so calculated on 15,000)
    // 15,000 * 12% = 1800
    const resultCap = await pensionCalculator.calculatePensionContribution(employeeId, tenantId, 20000);

    expect(resultCap.employeeContribution).toBe(1800);
    expect(resultCap.employerContribution).toBe(1800);
    expect(resultCap.planName).toBe('Provident Fund');

    // Case B: baseSalary 10,000 (below cap, calculated on 10,000)
    // 10,000 * 12% = 1200
    EmployeePensionSetting.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValueOnce(mockSetting),
    });
    const resultBelow = await pensionCalculator.calculatePensionContribution(employeeId, tenantId, 10000);
    expect(resultBelow.employeeContribution).toBe(1200);
  });

  test('calculatePensionContribution should auto-enrol employee if no settings exist', async () => {
    const employeeId = 'emp123';
    const tenantId = 'tenant123';

    // No setting exists yet
    EmployeePensionSetting.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValueOnce(null),
    });

    // Employee is in India
    Employee.findById.mockResolvedValueOnce({
      _id: employeeId,
      address: { country: 'IN' },
    });

    const mockPolicy = {
      _id: 'policyPF',
      planName: 'Provident Fund',
      employeeContributionRate: 12,
      employerContributionRate: 12,
      monthlySalaryCap: 15000,
    };

    PensionPolicy.findOne.mockResolvedValueOnce(mockPolicy);

    EmployeePensionSetting.create.mockResolvedValueOnce({
      tenantId,
      employeeId,
      pensionPolicyId: mockPolicy._id,
      isEnrolled: true,
    });

    const result = await pensionCalculator.calculatePensionContribution(employeeId, tenantId, 10000);

    expect(Employee.findById).toHaveBeenCalledWith(employeeId);
    expect(PensionPolicy.findOne).toHaveBeenCalledWith({ tenantId, region: 'IN', isActive: true });
    expect(EmployeePensionSetting.create).toHaveBeenCalledWith({
      tenantId,
      employeeId,
      pensionPolicyId: 'policyPF',
      isEnrolled: true,
    });
    expect(result.employeeContribution).toBe(1200);
  });

  test('createPolicy controller should insert policy and return 201', async () => {
    PensionPolicy.create.mockResolvedValueOnce({
      region: 'US',
      planName: '401(k)',
    });

    const req = {
      tenantId: 'tenant123',
      body: {
        region: 'US',
        planName: '401(k)',
        employeeContributionRate: 5,
        employerContributionRate: 4,
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await createPolicy(req, res, next);

    expect(PensionPolicy.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
