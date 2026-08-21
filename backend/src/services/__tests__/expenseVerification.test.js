const { verifyExpenseClaim } = require('../expenseVerification');
const { calculateImageHash } = require('../../utils/imageHasher');
const { submitClaim, getFraudClaims } = require('../../controllers/expense.controller');
const ExpenseClaim = require('../../models/expenseClaim.model');
const { ExpensePolicy } = require('../../models/expensePolicy.model');
const ExpenseCategory = require('../../models/expenseCategory.model');
const Employee = require('../../models/employee.model');

// Mock models
jest.mock('../../models/expenseClaim.model', () => {
  const mockFind = jest.fn();
  const mockFindOne = jest.fn();
  const mockCreate = jest.fn();
  return {
    find: mockFind,
    findOne: mockFindOne,
    create: mockCreate,
  };
});

jest.mock('../../models/expensePolicy.model', () => {
  const mockFindOne = jest.fn();
  return {
    ExpensePolicy: {
      findOne: mockFindOne,
    },
  };
});

jest.mock('../../models/expenseCategory.model', () => {
  const mockFindOne = jest.fn();
  const mockFindById = jest.fn();
  return {
    findOne: mockFindOne,
    findById: mockFindById,
  };
});

jest.mock('../../models/employee.model', () => {
  const mockFindOne = jest.fn();
  return {
    findOne: mockFindOne,
  };
});

// Mock ocr service and policy evaluation
jest.mock('../ocr.service', () => ({
  extractReceiptData: jest.fn().mockResolvedValue({
    merchant: 'Test Vendor',
    confidence: 0.95,
    rawText: 'Test Receipt Raw Text',
    date: new Date('2026-08-20'),
  }),
  isConfidenceReliable: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/policyEngine.utils', () => ({
  evaluateClaim: jest.fn().mockResolvedValue({
    violations: [],
    isCompliant: true,
  }),
}));

// Mock logger & eventBus
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../event.service', () => ({
  emit: jest.fn(),
}));

describe('Expense Fraud Detection & OCR Verification Engine (#1248)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calculateImageHash should return SHA-256 hex string', () => {
    const buffer = Buffer.from('mock receipt data', 'utf8');
    const hash = calculateImageHash(buffer);
    expect(hash).toHaveLength(64);
    expect(typeof hash).toBe('string');
  });

  test('verifyExpenseClaim should flag duplicate image hashes', async () => {
    const mockClaim = {
      _id: 'claim_new',
      tenantId: 'tenant123',
      employeeId: 'emp123',
      categoryId: 'cat123',
      amount: 100,
      currency: 'INR',
      expenseDate: new Date(),
      imageHash: 'duplicate_hash_xyz',
      ocrMetadata: {},
    };

    // Mock finding a duplicate
    ExpenseClaim.findOne.mockResolvedValueOnce({ _id: 'claim_old' });
    ExpensePolicy.findOne.mockResolvedValueOnce(null); // skip policy rules check

    const verified = await verifyExpenseClaim(mockClaim);

    expect(verified.isPossibleFraud).toBe(true);
    expect(verified.fraudDetails).toContain('Duplicate receipt detected');
  });

  test('verifyExpenseClaim should flag OCR metadata discrepancies', async () => {
    const mockClaim = {
      _id: 'claim123',
      tenantId: 'tenant123',
      employeeId: 'emp123',
      categoryId: 'cat123',
      amount: 150,
      currency: 'INR',
      expenseDate: new Date('2026-08-20'),
      imageHash: 'hash123',
      ocrMetadata: {
        extractedAmount: 120, // Different
        extractedCurrency: 'USD', // Different
        extractedDate: new Date('2026-08-19'), // Different
      },
    };

    ExpenseClaim.findOne.mockResolvedValueOnce(null); // No duplicates
    ExpensePolicy.findOne.mockResolvedValueOnce(null);

    const verified = await verifyExpenseClaim(mockClaim);

    expect(verified.isPossibleFraud).toBe(true);
    expect(verified.ocrMetadata.amountMatches).toBe(false);
    expect(verified.ocrMetadata.currencyMatches).toBe(false);
    expect(verified.ocrMetadata.dateMatches).toBe(false);
    expect(verified.fraudDetails).toContain('OCR amount mismatch');
    expect(verified.fraudDetails).toContain('OCR date mismatch');
    expect(verified.fraudDetails).toContain('OCR currency mismatch');
  });

  test('verifyExpenseClaim should flag claims exceeding policy limits', async () => {
    const mockClaim = {
      _id: 'claim123',
      tenantId: 'tenant123',
      employeeId: 'emp123',
      categoryId: 'cat123',
      amount: 600, // Exceeds single claim limit of 500
      currency: 'INR',
      expenseDate: new Date('2026-08-20'),
      imageHash: 'hash123',
      ocrMetadata: {},
    };

    const mockPolicy = {
      categories: [
        {
          category: 'Meals',
          maxLimitPerClaim: 500,
          maxLimitPerMonth: 2000,
        },
      ],
    };

    ExpenseClaim.findOne.mockResolvedValueOnce(null); // No duplicate
    ExpensePolicy.findOne.mockResolvedValueOnce(mockPolicy);
    ExpenseCategory.findById.mockResolvedValueOnce({ name: 'Meals' });

    const verified = await verifyExpenseClaim(mockClaim);

    expect(verified.isPossibleFraud).toBe(true);
    expect(verified.fraudDetails).toContain('exceeds category limit per claim of 500');
  });

  test('submitClaim controller should flag fraud and force Pending Manager status', async () => {
    Employee.findOne.mockResolvedValueOnce({ _id: 'emp123' });
    ExpensePolicy.findOne.mockResolvedValueOnce({
      currency: 'INR',
      autoApprovalThreshold: 1000,
      categories: [],
    });
    ExpenseCategory.findOne.mockResolvedValueOnce({ _id: 'cat123', name: 'Meals' });
    ExpenseClaim.findOne.mockResolvedValueOnce({ _id: 'claim_duplicate' }); // Simulate duplicate fraud
    ExpenseClaim.create.mockImplementationOnce(data => data);

    const req = {
      tenantId: 'tenant123',
      userId: 'user123',
      body: {
        category: 'Meals',
        amount: 250,
        expenseDate: new Date(),
        description: 'Business Lunch',
        imageHash: 'some_hash',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await submitClaim(req, res, next);

    expect(ExpenseClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isPossibleFraud: true,
        status: 'Pending Manager', // Forced manager review
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
