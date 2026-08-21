const { runTreasuryRebalancingJob } = require('../../jobs/treasuryRebalance.job');
const { getVaults, executeSwap, getRebalanceLogs } = require('../../controllers/treasury.controller');
const Treasury = require('../../models/treasury.model');
const Settlement = require('../../models/settlement.model');
const TreasuryRebalanceLog = require('../../models/treasuryRebalanceLog.model');

// Mock models
jest.mock('../../models/treasury.model', () => {
  const mockFind = jest.fn();
  return {
    find: mockFind,
  };
});

jest.mock('../../models/settlement.model', () => {
  const mockFind = jest.fn();
  return {
    find: mockFind,
  };
});

jest.mock('../../models/treasuryRebalanceLog.model', () => {
  const mockCreate = jest.fn();
  const mockFind = jest.fn();
  return {
    create: mockCreate,
    find: mockFind,
  };
});

// Mock service
const mockExecuteDbLiquiditySwap = jest.fn();
const mockGetDbVaults = jest.fn();
jest.mock('../../services/MultiCurrencyTreasuryService', () => {
  return {
    MultiCurrencyTreasuryService: jest.fn().mockImplementation(() => {
      return {
        executeDbLiquiditySwap: mockExecuteDbLiquiditySwap,
        getDbVaults: mockGetDbVaults,
      };
    }),
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Treasury Vault Auto-Rebalancing & Swap Engine (#1249)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('runTreasuryRebalancingJob should identify reserves deficits and trigger swaps', async () => {
    const mockTreasury = {
      tenantId: 'tenant123',
      baseCurrency: 'USD',
      balances: new Map([['USD', 50000], ['EUR', 200000], ['GBP', 50000]]), // USD is low (reserve limit is 100k)
      minReserves: new Map([['USD', 100000], ['EUR', 50000], ['GBP', 30000]]),
    };

    Treasury.find.mockResolvedValueOnce([mockTreasury]);

    // Mock pending settlements liability: 10000 USD
    const mockSettlements = [
      {
        netSettlement: 10000,
        employeeId: { targetCurrency: 'USD' },
      },
    ];
    Settlement.find.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValueOnce(mockSettlements),
    }));

    mockExecuteDbLiquiditySwap.mockResolvedValueOnce({ success: true, convertedUSD: 60000 });

    const result = await runTreasuryRebalancingJob();

    // Deficit in USD = (100k minReserve + 10k liability) - 50k balance = 60k deficit
    expect(result.swapsExecuted).toBe(1);
    expect(mockExecuteDbLiquiditySwap).toHaveBeenCalledWith(
      'tenant123',
      'EUR', // Swapped from EUR (EUR has 200k balance, 50k reserve, so 150k surplus)
      'USD',
      expect.any(Number)
    );
    expect(TreasuryRebalanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant123',
        toCurrency: 'USD',
        status: 'Success',
      })
    );
  });

  test('getVaults controller should invoke getDbVaults on the service', async () => {
    mockGetDbVaults.mockResolvedValueOnce([{ currencyCode: 'USD', totalBalance: 1000 }]);

    const req = { tenantId: 'tenant123' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await getVaults(req, res, next);

    expect(mockGetDbVaults).toHaveBeenCalledWith('tenant123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
    }));
  });

  test('executeSwap controller should reject negative amounts', async () => {
    const req = {
      tenantId: 'tenant123',
      body: { fromCurrency: 'EUR', toCurrency: 'USD', amount: -500 },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await executeSwap(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
