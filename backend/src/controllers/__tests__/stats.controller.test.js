const { getDepartments, getStats } = require('../stats.controller');
const Employee = require('../../models/employee.model');
const cacheService = require('../../services/cache.service');

jest.mock('../../models/employee.model', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../../services/cache.service', () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
}));

describe('stats controller cache layer', () => {
  const next = jest.fn();
  const req = { tenantId: 'tenant-1' };
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    cacheService.get.mockResolvedValue(null);
    cacheService.setEx.mockResolvedValue(undefined);
  });

  it('serves departments from cache without querying MongoDB', async () => {
    const cached = { departments: [{ name: 'Engineering', employeeCount: 4 }], count: 1 };
    cacheService.get.mockResolvedValue(cached);

    await getDepartments(req, res, next);

    expect(Employee.aggregate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ...cached, _cached: true });
  });

  it('caches departments per tenant after a miss', async () => {
    Employee.aggregate.mockResolvedValue([
      { _id: 'Engineering', employeeCount: 4 },
      { _id: 'Sales', employeeCount: 2 },
    ]);

    await getDepartments(req, res, next);

    expect(Employee.aggregate).toHaveBeenCalledTimes(1);
    expect(cacheService.setEx).toHaveBeenCalledWith(
      'departments:tenant-1',
      600,
      {
        departments: [
          { name: 'Engineering', employeeCount: 4 },
          { name: 'Sales', employeeCount: 2 },
        ],
        count: 2,
      },
      ['departments:tenant-1'],
    );
  });

  it('serves stats from cache without querying MongoDB', async () => {
    const cached = { stats: { totalEmployees: 5 } };
    cacheService.get.mockResolvedValue(cached);

    await getStats(req, res, next);

    expect(Employee.aggregate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ...cached, _cached: true });
  });

  it('caches computed stats per tenant after a miss', async () => {
    Employee.aggregate.mockResolvedValue([
      {
        totalEmployees: 5,
        activeEmployees: 4,
        totalMonthlySalary: 250000,
        departments: ['Engineering', 'Sales', ''],
      },
    ]);

    await getStats(req, res, next);

    expect(cacheService.setEx).toHaveBeenCalledWith(
      'stats:tenant-1',
      300,
      {
        stats: {
          totalEmployees: 5,
          activeEmployees: 4,
          inactiveEmployees: 1,
          totalDepartments: 2,
          totalMonthlySalary: 250000,
        },
      },
      ['stats:tenant-1'],
    );
  });

  it('rejects requests without tenant context', async () => {
    await getStats({ tenantId: null }, res, next);

    expect(Employee.aggregate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Tenant context is required',
    });
  });
});
