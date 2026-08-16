'use strict';

const { tenantPoolManager, ensureTenantForUser } = require('../tenant.service');

describe('TenantConnectionPool & TenantService', () => {
  afterAll(async () => {
    await tenantPoolManager.closeAll();
  });

  describe('tenantPoolManager', () => {
    it('should initialize pool manager with zero active pools', () => {
      const stats = tenantPoolManager.getPoolStats();
      expect(stats.activePoolsCount).toBe(0);
      expect(stats.tenants).toEqual([]);
    });

    it('should create and cache tenant connection pool', async () => {
      const mockTenantId = '66b1a2b3c4d5e6f7a8b9c0d1';
      const conn = await tenantPoolManager.getConnection(mockTenantId);

      expect(conn).toBeDefined();
      expect(conn.readyState).toBe(1); // Connected

      const stats = tenantPoolManager.getPoolStats();
      expect(stats.activePoolsCount).toBe(1);
      expect(stats.tenants).toContain(mockTenantId);
    });
  });

  describe('ensureTenantForUser', () => {
    it('should return null when user object is invalid', async () => {
      const result = await ensureTenantForUser(null);
      expect(result).toBeNull();
    });

    it('should return existing tenantId if user already has one', async () => {
      const mockUser = { _id: 'u123', tenantId: 't456' };
      const result = await ensureTenantForUser(mockUser);
      expect(result).toBe('t456');
    });
  });
});
