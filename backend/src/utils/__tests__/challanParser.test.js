const { parseChallanPdf } = require('../challanParser.utils');
const { uploadPaymentReceipt } = require('../../controllers/statutory.controller');
const { StatutoryChallan } = require('../../models/statutoryChallan.model');

// Mock StatutoryChallan model
jest.mock('../../models/statutoryChallan.model', () => {
  const mockFindOne = jest.fn();
  return {
    StatutoryChallan: {
      findOne: mockFindOne,
    },
  };
});

// Mock logger
jest.mock('../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Statutory Challan Parser & Verification (#1212)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('parseChallanPdf should parse amount and taxId from text', async () => {
    const rawPdfText = `
      GOVERNMENT OF INDIA
      EPFO CHALLAN RECEIPT
      TRRN: 101234567890
      TAX ID: AB123456
      TOTAL CHALLAN AMOUNT: 15000.50
    `;
    const buffer = Buffer.from(rawPdfText, 'utf8');

    const result = await parseChallanPdf(buffer);

    expect(result.amount).toBe(15000.50);
    expect(result.taxId).toBe('101234567890'); // Matches first matching pattern (trrn)
  });

  test('parseChallanPdf should parse alternative patterns', async () => {
    const rawPdfText = `
      Challan No: CHN-998877
      Paid: INR 25,000
    `;
    const buffer = Buffer.from(rawPdfText, 'utf8');

    const result = await parseChallanPdf(buffer);

    expect(result.amount).toBe(25000);
    expect(result.taxId).toBe('CHN-998877');
  });

  test('uploadPaymentReceipt controller should mark reconciled on matching amount', async () => {
    const mockChallan = {
      _id: 'c123',
      tenantId: 't123',
      totalChallanAmount: 15000.50,
      status: 'Generated',
      save: jest.fn().mockResolvedValue({}),
    };
    StatutoryChallan.findOne.mockResolvedValueOnce(mockChallan);

    const req = {
      tenantId: 't123',
      body: {
        challanId: 'c123',
        receiptText: 'TRRN: 101234567890\nTotal Challan Amount: 15000.50',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await uploadPaymentReceipt(req, res, next);

    expect(mockChallan.status).toBe('reconciled');
    expect(mockChallan.extractedChallanAmount).toBe(15000.50);
    expect(mockChallan.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('reconciled'),
    }));
  });

  test('uploadPaymentReceipt controller should mark discrepancy on mismatching amount', async () => {
    const mockChallan = {
      _id: 'c123',
      tenantId: 't123',
      totalChallanAmount: 15000.50,
      status: 'Generated',
      save: jest.fn().mockResolvedValue({}),
    };
    StatutoryChallan.findOne.mockResolvedValueOnce(mockChallan);

    const req = {
      tenantId: 't123',
      body: {
        challanId: 'c123',
        receiptText: 'TRRN: 101234567890\nTotal Challan Amount: 14000.00', // Mismatching
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await uploadPaymentReceipt(req, res, next);

    expect(mockChallan.status).toBe('discrepancy');
    expect(mockChallan.extractedChallanAmount).toBe(14000.00);
    expect(mockChallan.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('discrepancy'),
    }));
  });
});
