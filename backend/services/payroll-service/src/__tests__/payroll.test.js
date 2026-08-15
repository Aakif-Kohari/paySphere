const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');

// Mock Payroll Model
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  const mockSave = jest.fn().mockResolvedValue({});
  const mockFind = jest.fn();

  const mockModel = jest.fn().mockImplementation(() => ({
    save: mockSave,
  }));
  mockModel.find = mockFind;

  return {
    ...actualMongoose,
    model: jest.fn().mockReturnValue(mockModel),
    models: {},
  };
});

describe('Payroll Service Microservice (#1040)', () => {
  let PayrollMock;
  const secret = 'fallback-secret-key';
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    PayrollMock = mongoose.model('Payroll');
    token = jwt.sign({ userId: 'u123', email: 'john@example.com' }, secret);
  });

  test('POST /api/payroll/calculate - rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .send({
        month: 8,
        year: 2026,
        baseSalary: 50000,
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/payroll/calculate - calculates payroll and saves record when authenticated', async () => {
    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: 8,
        year: 2026,
        baseSalary: 50000,
        overtimeHours: 10,
        overtimeRate: 200,
        bonus: 1000,
        deductions: 500,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    // Overtime pay = 10 * 200 = 2000. Net salary = 50000 + 2000 + 1000 - 500 = 52500
    expect(res.body.data.netSalary).toBe(52500);
  });
});
