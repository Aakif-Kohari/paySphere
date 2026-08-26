const taxSyncService = require('../taxSync.service');
const { runTaxSyncJob } = require('../../jobs/taxSync.job');
const { syncTaxSlabs, getSyncLogs } = require('../../controllers/regionalTax.controller');
const TaxJurisdiction = require('../../models/taxJurisdiction.model');
const StateTaxRules = require('../../models/stateTaxRules.model');
const { TaxSyncLog } = require('../../models/regionalTax.model');
const { acquireLock, releaseLock } = require('../../utils/lockManager');
const axios = require('axios');

// Mock models and utils
jest.mock('../../models/taxJurisdiction.model', () => {
  const mockFind = jest.fn();
  const mockDistinct = jest.fn();
  return {
    find: mockFind,
    distinct: mockDistinct,
  };
});

jest.mock('../../models/stateTaxRules.model', () => {
  const mockUpdateMany = jest.fn();
  const mockCreate = jest.fn();
  return {
    updateMany: mockUpdateMany,
    create: mockCreate,
  };
});

jest.mock('../../models/regionalTax.model', () => {
  const mockCreate = jest.fn();
  const mockFind = jest.fn();
  return {
    TaxSyncLog: {
      create: mockCreate,
      find: mockFind,
    },
  };
});

jest.mock('../../utils/lockManager', () => ({
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('axios');

describe('Regional Tax Slab Sync Engine (#1245)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('syncRegionalTaxSlabs should successfully update state tax rules and log results', async () => {
    const tenantId = 'tenant123';
    const mockJurisdictions = [
      { _id: 'j1', stateCode: 'CA', isActive: true },
      { _id: 'j2', stateCode: 'NY', isActive: true },
    ];

    TaxJurisdiction.find.mockResolvedValueOnce(mockJurisdictions);

    // Mock compliance API returning updated rates
    axios.get.mockResolvedValueOnce({
      data: {
        brackets: {
          'CA': {
            standardDeduction: 6000,
            brackets: [{ minIncome: 0, maxIncome: 50000, rate: 5 }],
            flatTaxRate: 0,
            surchargeRate: 0.5,
            professionalTax: 120
          },
          'NY': {
            standardDeduction: 9000,
            brackets: [{ minIncome: 0, maxIncome: Infinity, rate: 6 }],
            flatTaxRate: 0,
            surchargeRate: 0,
            professionalTax: 0
          }
        }
      }
    });

    const result = await taxSyncService.syncRegionalTaxSlabs(tenantId, 'OnDemand');

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);

    // Should deactivate previous rules
    expect(StateTaxRules.updateMany).toHaveBeenCalledTimes(2);
    expect(StateTaxRules.updateMany).toHaveBeenLastCalledWith(
      { tenantId, jurisdictionId: 'j2', effectiveTo: null },
      { $set: { effectiveTo: expect.any(Date) } }
    );

    // Should create new rules
    expect(StateTaxRules.create).toHaveBeenCalledTimes(2);
    expect(StateTaxRules.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      jurisdictionId: 'j1',
      standardDeduction: 6000,
      surchargeRate: 0.5,
    }));

    // Should create a success log
    expect(TaxSyncLog.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      syncType: 'OnDemand',
      status: 'Success',
      bracketsUpdated: 2,
    }));
  });

  test('syncRegionalTaxSlabs should log Failure on API error and no fallbacks', async () => {
    const tenantId = 'tenant123';
    TaxJurisdiction.find.mockRejectedValueOnce(new Error('Database Connection Error'));

    const result = await taxSyncService.syncRegionalTaxSlabs(tenantId, 'Scheduled');

    expect(result.success).toBe(false);
    expect(TaxSyncLog.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      syncType: 'Scheduled',
      status: 'Failed',
    }));
  });

  test('runTaxSyncJob should acquire lock and iterate over distinct tenants', async () => {
    TaxJurisdiction.distinct.mockResolvedValueOnce(['tenant1', 'tenant2']);
    
    // Mock service to return success
    jest.spyOn(taxSyncService, 'syncRegionalTaxSlabs').mockResolvedValue({ success: true, updatedCount: 2 });

    const result = await runTaxSyncJob();

    expect(result.success).toBe(true);
    expect(result.totalUpdated).toBe(4);
    expect(acquireLock).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  });

  test('syncTaxSlabs controller should respond with status 200 and updated count', async () => {
    jest.spyOn(taxSyncService, 'syncRegionalTaxSlabs').mockResolvedValueOnce({ success: true, updatedCount: 3 });

    const req = { tenantId: 'tenant123' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await syncTaxSlabs(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      updatedCount: 3,
    }));
  });

  test('getSyncLogs controller should return sorted logs', async () => {
    const mockLogs = [{ syncType: 'OnDemand', status: 'Success' }];
    TaxSyncLog.find.mockReturnValue({
      sort: jest.fn().mockResolvedValueOnce(mockLogs),
    });

    const req = { tenantId: 'tenant123' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await getSyncLogs(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ logs: mockLogs });
  });
});
