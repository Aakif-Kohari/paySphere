'use strict';
const request = require('supertest');
const mongoose = require('mongoose');
const { sealDocument, verifySeal } = require('../services/cryptographicSeal.service');

jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
}));

describe('Public Verification API and Sealing Service', () => {
  let app;
  let DocumentSeal;

  beforeAll(() => {
    app = require('../app');
    DocumentSeal = require('../models/documentSeal.model');
  });

  afterEach(async () => {
    await DocumentSeal.deleteMany({});
  });

  describe('Document Sealing Service Helpers', () => {
    it('successfully seals and verifies a mock document', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const employeeId = new mongoose.Types.ObjectId();
      const signedBy = new mongoose.Types.ObjectId();
      
      const seal = await sealDocument({
        tenantId,
        employeeId,
        documentType: 'payslip',
        documentContent: 'Gross Salary: $5000, Net Salary: $4200',
        signedBy,
      });

      expect(seal).toBeDefined();
      expect(seal.documentHash).toBeDefined();
      expect(seal.signature).toBeDefined();

      const result = await verifySeal(seal.documentHash);
      expect(result.verified).toBe(true);
    });

    it('returns verified: false for an invalid hash', async () => {
      const result = await verifySeal('invalidhash123456');
      expect(result.verified).toBe(false);
    });
  });

  describe('Document Verification endpoint', () => {
    it('POST /api/public/verification/verify returns 400 when hash is empty', async () => {
      const res = await request(app)
        .post('/api/public/verification/verify')
        .send({ hash: '' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Document hash is required for verification.');
    });

    it('POST /api/public/verification/verify returns 404 when document not found', async () => {
      const res = await request(app)
        .post('/api/public/verification/verify')
        .send({ hash: 'nonexistenthash1234567890' });

      expect(res.status).toBe(404);
      expect(res.body.verified).toBe(false);
    });
  });
});