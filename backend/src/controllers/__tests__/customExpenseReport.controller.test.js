const {
  createCustomReport,
  getMyReports,
  exportExpenseReport,
  updateReportStatus,
} = require('../expense.controller');
const ExpenseReport = require('../../models/expenseReport.model');
const ExpenseClaim = require('../../models/expenseClaim.model');
const mongoose = require('mongoose');

jest.mock('../../models/expenseReport.model');
jest.mock('../../models/expenseClaim.model');
jest.mock('../../models/employee.model');

describe('Custom Expense Report Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      userId: new mongoose.Types.ObjectId().toString(),
      tenantId: new mongoose.Types.ObjectId().toString(),
      accountType: 'EMPLOYEE',
      user: { employeeId: new mongoose.Types.ObjectId().toString() },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('createCustomReport', () => {
    it('should return 400 if title is missing', async () => {
      req.body = { description: 'Missing title' };
      await createCustomReport(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Title is required' });
    });

    it('should create custom report with aggregated claims total', async () => {
      const claimId1 = new mongoose.Types.ObjectId().toString();
      const claimId2 = new mongoose.Types.ObjectId().toString();

      req.body = {
        title: 'Q3 Travel & Client Lunch',
        description: 'Business trip expenses',
        claimIds: [claimId1, claimId2],
      };

      ExpenseClaim.find.mockResolvedValue([
        { _id: claimId1, amount: 250 },
        { _id: claimId2, amount: 150 },
      ]);

      const mockReport = {
        _id: new mongoose.Types.ObjectId().toString(),
        title: 'Q3 Travel & Client Lunch',
        totalAmount: 400,
        status: 'submitted',
      };
      ExpenseReport.create.mockResolvedValue(mockReport);

      await createCustomReport(req, res, next);

      expect(ExpenseReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Q3 Travel & Client Lunch',
          totalAmount: 400,
          status: 'submitted',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Custom expense report created successfully',
        report: mockReport,
      });
    });
  });

  describe('getMyReports', () => {
    it('should fetch expense reports for authenticated user', async () => {
      const mockReports = [
        { _id: 'rep1', title: 'June Expenses', totalAmount: 500, status: 'submitted' },
      ];

      ExpenseReport.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockReports),
        }),
      });

      await getMyReports(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ reports: mockReports });
    });
  });

  describe('exportExpenseReport', () => {
    it('should calculate summary breakdown and return claims for export', async () => {
      req.query = { category: 'Travel', status: 'approved' };
      const mockClaims = [
        { _id: 'c1', category: 'Travel', amount: 300, status: 'approved' },
        { _id: 'c2', category: 'Travel', amount: 200, status: 'approved' },
      ];

      ExpenseClaim.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockClaims),
      });

      await exportExpenseReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalClaims: 2,
            totalAmount: 500,
            categoryBreakdown: { Travel: 500 },
          }),
          claims: mockClaims,
        })
      );
    });
  });

  describe('updateReportStatus', () => {
    it('should return 400 for invalid status transition', async () => {
      req.params = { id: 'rep1' };
      req.body = { status: 'invalid_status' };

      await updateReportStatus(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid status transition' });
    });

    it('should update status to reimbursed and record reimbursedAt date', async () => {
      req.params = { id: 'rep1' };
      req.body = { status: 'reimbursed' };

      const mockReport = {
        _id: 'rep1',
        status: 'approved',
        save: jest.fn().mockResolvedValue(true),
      };
      ExpenseReport.findOne.mockResolvedValue(mockReport);

      await updateReportStatus(req, res, next);

      expect(mockReport.status).toBe('reimbursed');
      expect(mockReport.reimbursedAt).toBeInstanceOf(Date);
      expect(mockReport.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
