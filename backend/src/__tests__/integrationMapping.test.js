'use strict';
const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
}));

describe('Core-HRMS Integration Settings & Mapping API', () => {
  let app;
  let IntegrationFieldMap;

  beforeAll(() => {
    app = require('../app');
    IntegrationFieldMap = require('../models/integrationFieldMap.model');
  });

  afterEach(async () => {
    await IntegrationFieldMap.deleteMany({});
  });

  describe('Integration Custom Mapping Controller helper', () => {
    it('returns default mapping structure when map is missing', async () => {
      const { getFieldMapping } = require('../controllers/integration.controller');
      const req = {
        params: { provider: 'workday' },
        tenantId: new mongoose.Types.ObjectId(),
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

      await getFieldMapping(req, res, (err) => {});
      expect(res.statusCode).toBe(200);
      expect(res.body.mapping).toEqual({
        fullName: 'fullName',
        department: 'department',
        monthlySalary: 'monthlySalary',
      });
    });

    it('validates mapping object payload is present', async () => {
      const { saveFieldMapping } = require('../controllers/integration.controller');
      const req = {
        params: { provider: 'workday' },
        body: {}, // missing mapping object
        tenantId: new mongoose.Types.ObjectId(),
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

      await saveFieldMapping(req, res, (err) => {});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Mapping object is required.');
    });
  });

  describe('Integration Schema Mappings Endpoint Auth', () => {
    it('GET /api/integrations/:provider/mapping returns 401 when not authorized', async () => {
      const res = await request(app)
        .get('/api/integrations/bamboohr/mapping')
        .send();

      expect(res.status).toBe(401);
    });

    it('PUT /api/integrations/:provider/mapping returns 401 when not authorized', async () => {
      const res = await request(app)
        .put('/api/integrations/bamboohr/mapping')
        .send({ mapping: { fullName: 'name' } });

      expect(res.status).toBe(401);
    });
  });
});