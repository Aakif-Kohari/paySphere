const Employee = require('../../models/employee.model');
const employeeService = require('../employee.service');

jest.mock('../../models/employee.model');

describe('EmployeeService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createEmployee', () => {
    it('should successfully create an employee', async () => {
      const mockEmployee = { _id: 'emp1', fullName: 'John Doe', email: 'john@example.com' };
      Employee.prototype.save = jest.fn().mockResolvedValue(mockEmployee);

      const result = await employeeService.createEmployee({ fullName: 'John Doe', email: 'john@example.com' });

      expect(Employee.prototype.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockEmployee);
    });

    it('should throw an error if email is duplicate (code 11000)', async () => {
      const error = new Error('Duplicate key');
      error.code = 11000;
      Employee.prototype.save = jest.fn().mockRejectedValue(error);

      await expect(employeeService.createEmployee({ email: 'test@example.com' }))
        .rejects.toThrow('An employee with this email address already exists');
    });

    it('should throw original error if not duplicate email', async () => {
      const error = new Error('Validation failed');
      Employee.prototype.save = jest.fn().mockRejectedValue(error);

      await expect(employeeService.createEmployee({ fullName: '' }))
        .rejects.toThrow('Validation failed');
    });
  });

  describe('getEmployees', () => {
    it('should return employees and total count', async () => {
      const mockQuery = { createdBy: 'user1' };
      const mockOptions = { skip: 0, limit: 10, sort: { createdAt: -1 } };
      
      const mockEmployees = [{ _id: 'emp1' }, { _id: 'emp2' }];
      Employee.countDocuments.mockResolvedValue(2);
      
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockEmployees),
      };
      Employee.find.mockReturnValue(mockFind);

      const result = await employeeService.getEmployees(mockQuery, mockOptions);

      expect(Employee.countDocuments).toHaveBeenCalledWith(mockQuery);
      expect(Employee.find).toHaveBeenCalledWith(mockQuery);
      expect(mockFind.sort).toHaveBeenCalledWith(mockOptions.sort);
      expect(mockFind.skip).toHaveBeenCalledWith(mockOptions.skip);
      expect(mockFind.limit).toHaveBeenCalledWith(mockOptions.limit);
      expect(result.employees).toEqual(mockEmployees);
      expect(result.totalEmployees).toBe(2);
    });

    it('should throw error if find fails', async () => {
      Employee.countDocuments.mockRejectedValue(new Error('Database error'));

      await expect(employeeService.getEmployees({}))
        .rejects.toThrow('Database error');
    });
  });

  describe('getEmployeeById', () => {
    it('should return employee if found', async () => {
      const mockEmployee = { _id: 'emp1', fullName: 'John Doe' };
      Employee.findOne.mockResolvedValue(mockEmployee);

      const result = await employeeService.getEmployeeById('emp1', 'user1');

      expect(Employee.findOne).toHaveBeenCalledWith({ _id: 'emp1', createdBy: 'user1', deletedAt: null });
      expect(result).toEqual(mockEmployee);
    });

    it('should throw error if employee not found', async () => {
      Employee.findOne.mockResolvedValue(null);

      await expect(employeeService.getEmployeeById('emp1', 'user1'))
        .rejects.toThrow('Employee not found');
    });

    it('should throw database error', async () => {
      Employee.findOne.mockRejectedValue(new Error('DB Error'));

      await expect(employeeService.getEmployeeById('emp1', 'user1'))
        .rejects.toThrow('DB Error');
    });
  });

  describe('updateEmployee', () => {
    it('should update and return employee successfully', async () => {
      const mockEmployee = { _id: 'emp1', fullName: 'John Updated' };
      Employee.findOneAndUpdate.mockResolvedValue(mockEmployee);

      const result = await employeeService.updateEmployee('emp1', 'user1', { fullName: 'John Updated' });

      expect(Employee.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'emp1', createdBy: 'user1', deletedAt: null },
        { $set: { fullName: 'John Updated' } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(mockEmployee);
    });

    it('should throw error if employee not found on update', async () => {
      Employee.findOneAndUpdate.mockResolvedValue(null);

      await expect(employeeService.updateEmployee('emp1', 'user1', {}))
        .rejects.toThrow('Employee not found or could not be updated');
    });

    it('should throw duplicate email error on update', async () => {
      const error = new Error('Duplicate');
      error.code = 11000;
      Employee.findOneAndUpdate.mockRejectedValue(error);

      await expect(employeeService.updateEmployee('emp1', 'user1', { email: 'exist@example.com' }))
        .rejects.toThrow('An employee with this email address already exists');
    });
  });

  describe('deleteEmployee', () => {
    it('should soft delete and return employee', async () => {
      const mockEmployee = { _id: 'emp1', deletedAt: expect.any(Date), isActive: false };
      Employee.findOneAndUpdate.mockResolvedValue(mockEmployee);

      const result = await employeeService.deleteEmployee('emp1', 'user1');

      expect(Employee.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'emp1', createdBy: 'user1', deletedAt: null },
        { $set: { deletedAt: expect.any(Date), isActive: false } },
        { new: true }
      );
      expect(result).toEqual(mockEmployee);
    });

    it('should throw error if employee not found on delete', async () => {
      Employee.findOneAndUpdate.mockResolvedValue(null);

      await expect(employeeService.deleteEmployee('emp1', 'user1'))
        .rejects.toThrow('Employee not found');
    });
  });
});
