'use strict';
const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
}));

describe('Payroll Reconciliation API & Guard', () => {
  let app;
  let PayrollReconciliation;

  beforeAll(() => {
    app = require('../app');
    PayrollReconciliation = require('../models/payrollReconciliation.model');
  });

  afterEach(async () => {
    await PayrollReconciliation.deleteMany({});
  });

  describe('Reconciliation Input Constraints', () => {
    it('rejects overrides with justifications under 20 characters', async () => {
      // Mock authorization would be needed, so testing the controller helper direct
      const { reconcileAnomaly } = require('../controllers/payrollReconciliation.controller');
      const req = {
        body: {
          payrollId: new mongoose.Types.ObjectId(),
          anomalyType: 'HISTORICAL_SALARY_SPIKE',
          justification: 'Short comment',
        },
        tenantId: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
      };
      
      const res = {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        }
      };

      await reconcileAnomaly(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Justification must be at least 20 characters long.');
    });
  });

  describe('Reconciliation API endpoints', () => {
    it('POST /api/payroll/reconcile returns 400 when parameters are missing', async () => {
      const res = await request(app)
        .post('/api/payroll/reconcile')
        .send({ justification: '' });

      expect(res.status).toBe(400);
    });

    it('POST /api/payroll/reconcile returns 401 when not authorized', async () => {
      const res = await request(app)
        .post('/api/payroll/reconcile')
        .send({ payrollId: new mongoose.Types.ObjectId(), anomalyType: 'SPIKE', justification: 'This is a valid justification override.' });

      expect(res.status).toBe(401);
    });
  });
});