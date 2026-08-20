const request = require('supertest');
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'payroll-integration-test-secret';
let savedPayrolls;
let PayrollMock;

jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');

  savedPayrolls = [];

  class MockSchema {
    constructor() {}
  }

  PayrollMock = jest.fn().mockImplementation((data) => {
    const document = {
      ...data,
      _id: `payroll-${savedPayrolls.length + 1}`,
      save: jest.fn(async function save() {
        savedPayrolls.push(this);
        return this;
      }),
    };
    return document;
  });

  const models = {};
  Object.defineProperty(models, 'Payroll', {
    configurable: true,
    get: () => PayrollMock,
  });

  return {
    ...actualMongoose,
    Schema: MockSchema,
    models,
    model: jest.fn(() => PayrollMock),
  };
});

process.env.JWT_SECRET = TEST_SECRET;

const app = require('../app');

const makeToken = (overrides = {}) =>
  jwt.sign(
    {
      userId: 'employee-user-1',
      email: 'payroll@example.com',
      ...overrides,
    },
    TEST_SECRET,
  );

const validPayload = (overrides = {}) => ({
  month: 8,
  year: 2026,
  baseSalary: 50000,
  overtimeHours: 10,
  overtimeRate: 200,
  bonus: 1000,
  deductions: 500,
  ...overrides,
});

describe('Payroll Generation API integration tests (#1043)', () => {
  let token;

  beforeEach(() => {
    savedPayrolls.length = 0;
    jest.clearAllMocks();
    token = makeToken();
  });

  describe('authentication', () => {
    test('rejects requests without an Authorization header', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .send(validPayload());

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/authorization required/i);
      expect(PayrollMock).not.toHaveBeenCalled();
    });

    test('rejects malformed bearer tokens', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', 'Bearer not-a-real-token')
        .send(validPayload());

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/invalid or expired/i);
      expect(PayrollMock).not.toHaveBeenCalled();
    });

    test('accepts a valid bearer token and reaches payroll generation', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload());

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('employee-user-1');
      expect(response.body.data.month).toBe(8);
      expect(response.body.data.year).toBe(2026);
    });
  });

  describe('salary and deduction calculations', () => {
    test('calculates base salary plus overtime and bonus minus deductions', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload());

      expect(response.status).toBe(201);
      expect(response.body.data.baseSalary).toBe(50000);
      expect(response.body.data.overtimeHours).toBe(10);
      expect(response.body.data.overtimeRate).toBe(200);
      expect(response.body.data.bonus).toBe(1000);
      expect(response.body.data.deductions).toBe(500);

      // 50,000 + (10 * 200) + 1,000 - 500 = 52,500.
      expect(response.body.data.netSalary).toBe(52500);
    });

    test('applies deductions without overtime or bonus', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send(
          validPayload({
            overtimeHours: 0,
            overtimeRate: 0,
            bonus: 0,
            deductions: 2500,
          }),
        );

      expect(response.status).toBe(201);
      expect(response.body.data.netSalary).toBe(47500);
    });

    test('adds overtime compensation using the supplied overtime rate', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send(
          validPayload({
            baseSalary: 40000,
            overtimeHours: 15,
            overtimeRate: 300,
            bonus: 0,
            deductions: 0,
          }),
        );

      expect(response.status).toBe(201);
      expect(response.body.data.netSalary).toBe(44500);
    });

    test('adds bonuses after overtime and before deductions', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send(
          validPayload({
            baseSalary: 60000,
            overtimeHours: 5,
            overtimeRate: 250,
            bonus: 3500,
            deductions: 1000,
          }),
        );

      expect(response.status).toBe(201);
      // 60,000 + 1,250 + 3,500 - 1,000 = 63,750.
      expect(response.body.data.netSalary).toBe(63750);
    });

  });

  describe('request validation', () => {
    test.each([
      ['month', { month: undefined }],
      ['year', { year: undefined }],
      ['baseSalary', { baseSalary: undefined }],
    ])('rejects requests missing %s', async (_field, override) => {
      const payload = validPayload();
      delete payload[_field];

      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...payload, ...override });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/required/i);
      expect(savedPayrolls).toHaveLength(0);
    });

    test('rejects a zero month because it is not a valid payroll period', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload({ month: 0 }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(savedPayrolls).toHaveLength(0);
    });

    test('rejects a zero year because it is not a valid payroll period', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload({ year: 0 }));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(savedPayrolls).toHaveLength(0);
    });
  });

  describe('persistence and response contract', () => {
    test('persists the calculated payroll with the authenticated user id', async () => {
      const response = await request(app)
        .post('/api/payroll/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload());

      expect(response.status).toBe(201);
      expect(savedPayrolls).toHaveLength(1);
      expect(savedPayrolls[0]).toMatchObject({
        userId: 'employee-user-1',
        month: 8,
        year: 2026,
        baseSalary: 50000,
        overtimeHours: 10,
        overtimeRate: 200,
        bonus: 1000,
        deductions: 500,
        netSalary: 52500,
      });
      expect(response.body.data).toMatchObject(savedPayrolls[0]);
    });

  });
});
