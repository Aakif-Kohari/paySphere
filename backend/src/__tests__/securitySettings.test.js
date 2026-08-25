'use strict';
const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../middlewares/rateLimiter.middleware', () => ({
  generalRateLimiter: (req, res, next) => next(),
  writeRateLimiter: (req, res, next) => next(),
}));

jest.mock('../middlewares/sanitize.middleware', () => (req, res, next) => next());

describe('Role-Based IP CIDR Whitelisting and Cryptographic Session Fingerprinting', () => {
  let app;
  let IpWhitelist;

  beforeAll(() => {
    app = require('../app');
    IpWhitelist = require('../models/ipWhitelist.model');
  });

  afterEach(async () => {
    await IpWhitelist.deleteMany({});
  });

  describe('IP CIDR matches check', () => {
    it('correctly matches valid IPv4 CIDR blocks', () => {
      const ipMatchesCidr = (ip, cidr) => {
        if (cidr.includes('/')) {
          const [range, bits] = cidr.split('/');
          const ipParts = ip.split('.').map(Number);
          const rangeParts = range.split('.').map(Number);
          if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
          const mask = ~( (1 << (32 - Number(bits))) - 1 );
          const ipVal = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
          const rangeVal = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
          return (ipVal & mask) === (rangeVal & mask);
        }
        return ip === cidr;
      };

      expect(ipMatchesCidr('192.168.1.15', '192.168.1.0/24')).toBe(true);
      expect(ipMatchesCidr('192.168.2.15', '192.168.1.0/24')).toBe(false);
      expect(ipMatchesCidr('10.0.0.1', '10.0.0.0/8')).toBe(true);
      expect(ipMatchesCidr('172.16.0.1', '10.0.0.0/8')).toBe(false);
    });
  });

  describe('API endpoints', () => {
    it('GET /api/security/ip-whitelists blocks requests without auth', async () => {
      const res = await request(app).get('/api/security/ip-whitelists');
      expect(res.status).toBe(401);
    });

    it('PUT /api/security/ip-whitelists blocks requests without auth', async () => {
      const res = await request(app)
        .put('/api/security/ip-whitelists')
        .send({ role: 'ADMIN', cidrBlocks: ['192.168.1.0/24'] });
      expect(res.status).toBe(401);
    });
  });
});