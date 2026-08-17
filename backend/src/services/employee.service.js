const Employee = require('../models/employee.model');

class EmployeeService {
  /**
   * Create a new employee
   * @param {Object} employeeData 
   * @returns {Promise<Object>}
   */
  async createEmployee(employeeData) {
    try {
      const employee = new Employee(employeeData);
      return await employee.save();
    } catch (error) {
      if (error && error.code === 11000) {
        throw new Error('An employee with this email address already exists');
      }
      throw error;
    }
  }

  /**
   * Get employees by query
   * @param {Object} query 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async getEmployees(query, options = { skip: 0, limit: 10, sort: { createdAt: -1 } }) {
    try {
      const totalEmployees = await Employee.countDocuments(query);
      const employees = await Employee.find(query)
        .sort(options.sort)
        .skip(options.skip)
        .limit(options.limit);
      
      return { employees, totalEmployees };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get an employee by ID
   * @param {String} id 
   * @param {String} userId 
   * @returns {Promise<Object>}
   */
  async getEmployeeById(id, userId) {
    try {
      const employee = await Employee.findOne({ _id: id, createdBy: userId, deletedAt: null });
      if (!employee) {
        throw new Error('Employee not found');
      }
      return employee;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an employee
   * @param {String} id 
   * @param {String} userId 
   * @param {Object} updateData 
   * @returns {Promise<Object>}
   */
  async updateEmployee(id, userId, updateData) {
    try {
      const employee = await Employee.findOneAndUpdate(
        { _id: id, createdBy: userId, deletedAt: null },
        { $set: updateData },
        { new: true, runValidators: true }
      );
      if (!employee) {
        throw new Error('Employee not found or could not be updated');
      }
      return employee;
    } catch (error) {
      if (error && error.code === 11000) {
        throw new Error('An employee with this email address already exists');
      }
      throw error;
    }
  }

  /**
   * Soft delete an employee
   * @param {String} id 
   * @param {String} userId 
   * @returns {Promise<Object>}
   */
  async deleteEmployee(id, userId) {
    try {
      const employee = await Employee.findOneAndUpdate(
        { _id: id, createdBy: userId, deletedAt: null },
        { $set: { deletedAt: new Date(), isActive: false } },
        { new: true }
      );
      if (!employee) {
        throw new Error('Employee not found');
      }
      return employee;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new EmployeeService();
