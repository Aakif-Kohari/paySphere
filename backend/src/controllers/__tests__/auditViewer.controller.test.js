const { getAuditLogs, exportAuditLogsCSV, parseDateRange } = require('../audit.controller');
const auditLogRepository = require('../../repositories/auditLog.repository');
const cacheService = require('../../services/cache.service');
const mongoose = require('mongoose');

jest.mock('../../repositories/auditLog.repository');
jest.mock('../../services/cache.service', () => ({
  generateHash: jest.fn().mockReturnValue('mockhash'),
  get: jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue(true),
}));

describe('Audit Log Viewer Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      query: {},
      userId: new mongoose.Types.ObjectId().toString(),
      tenantId: new mongoose.Types.ObjectId().toString(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
    };
    next = jest.fn();
  });

  describe('parseDateRange', () => {
    it('should correctly parse valid startDate and endDate', () => {
      const result = parseDateRange({ startDate: '2026-01-01', endDate: '2026-01-31' });
      expect(result.ok).toBe(true);
      expect(result.range.$gte).toBeInstanceOf(Date);
      expect(result.range.$lte).toBeInstanceOf(Date);
    });

    it('should return error if startDate is after endDate', () => {
      const result = parseDateRange({ startDate: '2026-02-01', endDate: '2026-01-01' });
      expect(result.ok).toBe(false);
      expect(result.message).toContain('startDate must be on or before endDate');
    });
  });

  describe('getAuditLogs', () => {
    it('should fetch audit logs with pagination, search, and filters', async () => {
      req.query = { page: '1', limit: '20', resourceType: 'User', search: 'LOGIN' };

      const mockLogs = [
        {
          _id: 'log1',
          action: 'USER_LOGIN',
          resourceType: 'User',
          userId: { fullName: 'John Doe', email: 'john@example.com' },
          createdAt: new Date(),
        },
      ];

      auditLogRepository.findPaginatedLogs.mockResolvedValue(mockLogs);
      auditLogRepository.countDocuments.mockResolvedValue(1);

      await getAuditLogs(req, res, next);

      expect(auditLogRepository.findPaginatedLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'User',
          $or: expect.arrayContaining([{ action: expect.any(RegExp) }]),
        }),
        0,
        20
      );

      expect(res.success).toHaveBeenCalledWith(
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({
              action: 'USER_LOGIN',
            }),
          ]),
          metadata: expect.objectContaining({
            totalRecords: 1,
            currentPage: 1,
          }),
        })
      );
    });
  });

  describe('exportAuditLogsCSV', () => {
    it('should generate CSV file with filtered audit logs', async () => {
      req.query = { action: 'PAYROLL_FINALIZE' };

      const mockLogs = [
        {
          _id: 'log2',
          action: 'PAYROLL_FINALIZE',
          resourceType: 'Payroll',
          userId: { fullName: 'Admin User', email: 'admin@paysphere.com' },
          createdAt: new Date('2026-08-01'),
          result: 'success',
          details: { batch: 'August 2026' },
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
        },
      ];

      auditLogRepository.findExportLogs.mockResolvedValue(mockLogs);

      await exportAuditLogsCSV(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('PAYROLL_FINALIZE'));
    });
  });
});
