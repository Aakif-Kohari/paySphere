const cryptoPayoutWorker = require('../cryptoPayout.worker');
const web3Client = require('../../utils/web3Client');
const { CryptoPayoutBatch } = require('../../models/cryptoPayroll.model');
const { getWallets, disburseCryptoBatch, getPayoutLogs } = require('../../controllers/crypto.controller');

// Mock models and utils
jest.mock('../../models/cryptoPayroll.model', () => {
  const mockCreate = jest.fn();
  const mockFind = jest.fn();
  const mockFindById = jest.fn();
  return {
    CryptoPayoutBatch: {
      create: mockCreate,
      find: mockFind,
      findById: mockFindById,
    },
  };
});

jest.mock('../../utils/web3Client', () => ({
  batchTransferStablecoins: jest.fn(),
  getTransactionReceipt: jest.fn(),
  estimateOptimizedGas: jest.fn().mockResolvedValue({
    maxFeePerGas: '35000000000',
    maxPriorityFeePerGas: '2000000000',
    gasLimit: 150000
  })
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Cryptocurrency Payroll Payout Worker & EVM Sync (#1244)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('processPayoutBatch should execute batch stablecoin transfers and poll receipt', async () => {
    const batchId = 'batch123';
    const mockBatch = {
      _id: batchId,
      tokenAddress: '0xusdcTokenAddress',
      recipients: [
        { employeeId: 'emp1', address: '0xrec1', amount: 500 },
        { employeeId: 'emp2', address: '0xrec2', amount: 350 },
      ],
      txHash: null,
      status: 'Pending',
      save: jest.fn().mockResolvedValue(true),
    };

    CryptoPayoutBatch.findById.mockResolvedValueOnce(mockBatch);
    web3Client.batchTransferStablecoins.mockResolvedValueOnce('0xtxhash123');
    web3Client.getTransactionReceipt.mockResolvedValueOnce({
      success: true,
      blockNumber: 987654,
      confirmations: 12
    });

    // Mock setTimeout to return immediately
    jest.spyOn(global, 'setTimeout').mockImplementation(fn => fn());

    // We spy on pollTxReceipt
    const pollSpy = jest.spyOn(cryptoPayoutWorker, 'pollTxReceipt');

    await cryptoPayoutWorker.processPayoutBatch(batchId);

    expect(CryptoPayoutBatch.findById).toHaveBeenCalledWith(batchId);
    expect(web3Client.batchTransferStablecoins).toHaveBeenCalledWith(
      expect.any(String),
      '0xusdcTokenAddress',
      [{ address: '0xrec1', amount: 500 }, { address: '0xrec2', amount: 350 }]
    );
    expect(mockBatch.txHash).toBe('0xtxhash123');
    expect(mockBatch.status).toBe('Pending');
    expect(pollSpy).toHaveBeenCalledWith(batchId, '0xtxhash123');
  });

  test('pollTxReceipt should update status to Confirmed when transaction succeeds', async () => {
    const batchId = 'batch123';
    const mockBatch = {
      _id: batchId,
      status: 'Pending',
      blockNumber: null,
      confirmations: 0,
      confirmedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };

    CryptoPayoutBatch.findById.mockResolvedValueOnce(mockBatch);
    web3Client.getTransactionReceipt.mockResolvedValueOnce({
      success: true,
      blockNumber: 987654,
      confirmations: 12
    });

    await cryptoPayoutWorker.pollTxReceipt(batchId, '0xtxhash123');

    expect(mockBatch.status).toBe('Confirmed');
    expect(mockBatch.blockNumber).toBe(987654);
    expect(mockBatch.confirmations).toBe(12);
    expect(mockBatch.confirmedAt).toBeInstanceOf(Date);
    expect(mockBatch.save).toHaveBeenCalled();
  });

  test('disburseCryptoBatch controller should save model and trigger worker asynchronously', async () => {
    const mockBatch = {
      _id: 'batch123',
      status: 'Pending',
    };

    CryptoPayoutBatch.create.mockResolvedValueOnce(mockBatch);
    
    const workerSpy = jest.spyOn(cryptoPayoutWorker, 'processPayoutBatch').mockResolvedValueOnce();

    const req = {
      tenantId: 'tenant123',
      body: {
        walletId: 'wlt101',
        tokenSymbol: 'USDC-SPL',
        tokenAddress: '0xusdcTokenAddress',
        recipients: [
          { employeeId: 'emp1', address: '0xrec1', amount: 500 }
        ]
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await disburseCryptoBatch(req, res, next);

    expect(CryptoPayoutBatch.create).toHaveBeenCalled();
    expect(workerSpy).toHaveBeenCalledWith('batch123');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      batchId: 'batch123',
      status: 'Pending'
    }));
  });
});
