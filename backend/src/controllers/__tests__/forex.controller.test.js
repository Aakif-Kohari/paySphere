const { getReconciliationReport } = require('../forex.controller');
const PayrollUpdate = require('../../models/payroll.model');
const ExchangeRate = require('../../models/exchangeRate.model');

// Mock PayrollUpdate and ExchangeRate models
jest.mock('../../models/payroll.model', () => {
  return {
    find: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([
      {
        _id: 'p1',
        employeeName: 'John Doe',
        netSalary: 83500,
        currency: 'INR',
        targetCurrency: 'INR',
        baseCurrency: 'USD',
        exchangeRate: 83.5,
        convertedNetSalary: 1000,
        month: 8,
        year: 2026,
      },
      {
        _id: 'p2',
        employeeName: 'Jane Smith',
        netSalary: 920,
        currency: 'EUR',
        targetCurrency: 'EUR',
        baseCurrency: 'USD',
        exchangeRate: 0.92,
        convertedNetSalary: 1000,
        month: 8,
        year: 2026,
      }
    ]),
  };
});

jest.mock('../../models/exchangeRate.model', () => {
  return {
    findOne: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue({
      baseCurrency: 'USD',
      rates: {
        INR: 83.5,
        EUR: 0.92,
      },
      date: new Date(),
    }),
  };
});

describe('Forex Reconciliation Controller (#1093)', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 't123',
      query: { month: '8', year: '2026' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should return a compiled reconciliation report and correct variance calculation', async () => {
    // If current rates are EUR=0.92, INR=83.5, variance should be 0 because rates match
    await getReconciliationReport(req, res, next);

    expect(PayrollUpdate.find).toHaveBeenCalledWith({
      tenantId: 't123',
      month: 8,
      year: 2026,
    });
    expect(ExchangeRate.findOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.length).toBe(2);

    const inrRow = responseBody.data.find(r => r.targetCurrency === 'INR');
    expect(inrRow.variance).toBe(0);
  });

  test('should compute correct positive/negative variance when rates diverge', async () => {
    // Modify ExchangeRate to mock different current rate for INR (e.g. 80.0 instead of 83.5)
    ExchangeRate.lean.mockResolvedValueOnce({
      baseCurrency: 'USD',
      rates: {
        INR: 80.0,
        EUR: 0.92,
      },
    });

    await getReconciliationReport(req, res, next);

    const responseBody = res.json.mock.calls[0][0];
    const inrRow = responseBody.data.find(r => r.targetCurrency === 'INR');
    
    // Historical converted net salary = 83500 / 83.5 = 1000 USD
    // Current converted net salary = 83500 / 80.0 = 1043.75 USD
    // Variance = 1000 - 1043.75 = -43.75 USD
    expect(inrRow.variance).toBe(-43.75);
  });
});
