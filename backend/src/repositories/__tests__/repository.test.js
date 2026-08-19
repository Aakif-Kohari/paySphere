const mongoose = require('mongoose');
const userRepository = require('../user.repository');
const employeeRepository = require('../employee.repository');
const auditLogRepository = require('../auditLog.repository');
const User = require('../../models/user.model');
const Employee = require('../../models/employee.model');
const AuditLog = require('../../models/auditLog.model');

jest.mock('../../models/user.model', () => {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
  };
});

jest.mock('../../models/employee.model', () => {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
  };
});

jest.mock('../../models/auditLog.model', () => {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };
});

describe('Repository Pattern for Database Access (#1038)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('UserRepository', () => {
    test('findByEmail formats and calls findOne correctly', async () => {
      User.findOne.mockResolvedValue({ email: 'test@example.com' });
      
      const result = await userRepository.findByEmail(' TEST@EXAMPLE.com ');
      
      expect(result).toEqual({ email: 'test@example.com' });
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    test('findByGoogleId query is correctly formed', async () => {
      User.findOne.mockResolvedValue({ googleId: 'g123' });
      
      const result = await userRepository.findByGoogleId('g123');
      
      expect(result).toEqual({ googleId: 'g123' });
      expect(User.findOne).toHaveBeenCalledWith({ googleId: 'g123' });
    });

    test('findByResetToken applies assessment checks', async () => {
      User.findOne.mockResolvedValue({ resetPasswordToken: 't123' });
      
      const result = await userRepository.findByResetToken('t123');
      
      expect(result).toEqual({ resetPasswordToken: 't123' });
      expect(User.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          resetPasswordToken: 't123',
          resetPasswordExpires: { $gt: expect.any(Number) },
        })
      );
    });
  });

  describe('EmployeeRepository', () => {
    test('findActiveByTenant excludes soft deleted employees', async () => {
      const mockEmployees = [{ fullName: 'Emp A' }, { fullName: 'Emp B' }];
      const queryChain = {
        exec: jest.fn().mockResolvedValue(mockEmployees),
        then: jest.fn().mockImplementation(function (resolve) {
          return Promise.resolve(mockEmployees).then(resolve);
        }),
      };
      Employee.find.mockReturnValue(queryChain);

      const tenantId = new mongoose.Types.ObjectId().toString();
      const result = await employeeRepository.findActiveByTenant(tenantId);

      expect(result).toEqual(mockEmployees);
      expect(Employee.find).toHaveBeenCalledWith({
        tenantId,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      });
    });
  });

  describe('AuditLogRepository', () => {
    test('findPaginatedLogs chains query modifiers correctly', async () => {
      const mockLogs = [{ action: 'CREATE' }];
      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation(function (resolve) {
          return Promise.resolve(mockLogs).then(resolve);
        }),
      };
      
      AuditLog.find.mockReturnValue(mockQueryChain);

      const query = { tenantId: 't123' };
      const result = await auditLogRepository.findPaginatedLogs(query, 10, 50);

      expect(result).toEqual(mockLogs);
      expect(AuditLog.find).toHaveBeenCalledWith(query);
      expect(mockQueryChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockQueryChain.populate).toHaveBeenCalledWith({ path: 'userId', select: 'fullName email' });
      expect(mockQueryChain.skip).toHaveBeenCalledWith(10);
      expect(mockQueryChain.limit).toHaveBeenCalledWith(50);
    });
  });
});
