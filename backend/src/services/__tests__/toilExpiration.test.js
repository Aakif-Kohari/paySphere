const { processToilExpirations, sendToilExpiryWarnings } = require('../toilExpiration.service');
const { getUpcomingExpirationsByDepartment } = require('../../controllers/toil.controller');
const { ToilLedger } = require('../../models/toil.model');
const { enqueueEmail } = require('../../jobs/email.queue');

// Mock ToilLedger model
jest.mock('../../models/toil.model', () => {
  const mockFind = jest.fn();
  const mockCreate = jest.fn();
  const mockAggregate = jest.fn();
  return {
    ToilLedger: {
      find: mockFind,
      create: mockCreate,
      aggregate: mockAggregate,
    },
  };
});

// Mock email queue
jest.mock('../../jobs/email.queue', () => ({
  enqueueEmail: jest.fn().mockResolvedValue({}),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('TOIL Expiry & Warnings (#1210)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('processToilExpirations should find and expire unused TOIL', async () => {
    const mockAccruals = [
      {
        _id: 'acc1',
        tenantId: 'tenant1',
        employeeId: { _id: 'emp1', fullName: 'John Doe', email: 'john@test.com' },
        days: 3,
        createdAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ];

    ToilLedger.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(mockAccruals),
    }));

    // Mock aggregate to return 1 day of usage
    ToilLedger.aggregate
      .mockResolvedValueOnce([{ totalUsed: 1 }]) // Usage query
      .mockResolvedValueOnce([{ total: 3 }]);    // Balance query

    const result = await processToilExpirations();

    expect(result.expiredCount).toBe(1);
    expect(result.daysExpired).toBe(2); // 3 accrued - 1 used = 2 remaining
    expect(ToilLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      transactionType: 'Expiration',
      days: -2,
    }));
  });

  test('sendToilExpiryWarnings should trigger emails for TOIL expiring in 15 days', async () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 15);

    const mockWarnings = [
      {
        _id: 'acc2',
        tenantId: 'tenant1',
        employeeId: { _id: 'emp2', fullName: 'Jane Smith', email: 'jane@test.com' },
        days: 5,
        expiresAt: expiryDate,
        createdAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
      },
    ];

    ToilLedger.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(mockWarnings),
    }));

    ToilLedger.aggregate.mockResolvedValueOnce([{ totalUsed: 0 }]); // No usage yet

    const result = await sendToilExpiryWarnings();

    expect(result.warningCount).toBe(1);
    expect(enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'jane@test.com',
      subject: expect.stringContaining('Warning'),
    }));
  });

  test('getUpcomingExpirationsByDepartment controller should group by department string', async () => {
    const mockAccruals = [
      {
        _id: 'acc1',
        days: 2,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        employeeId: { _id: 'emp1', fullName: 'John Doe', email: 'john@test.com', department: 'Engineering' },
      },
      {
        _id: 'acc2',
        days: 3,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        employeeId: { _id: 'emp2', fullName: 'Jane Doe', email: 'jane@test.com', department: 'Product' },
      },
    ];

    ToilLedger.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(mockAccruals),
    }));

    ToilLedger.aggregate
      .mockResolvedValueOnce([{ totalUsed: 0 }])
      .mockResolvedValueOnce([{ totalUsed: 0 }]);

    const req = {
      tenantId: 'tenant1',
      query: { days: '30' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await getUpcomingExpirationsByDepartment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.departments.Engineering).toHaveLength(1);
    expect(response.departments.Product).toHaveLength(1);
    expect(response.departments.Engineering[0].employeeName).toBe('John Doe');
  });
});
