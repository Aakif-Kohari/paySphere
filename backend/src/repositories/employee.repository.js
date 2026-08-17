const BaseRepository = require('./base.repository');
const Employee = require('../models/employee.model');

/**
 * Concrete EmployeeRepository class handling specialized Employee queries.
 */
class EmployeeRepository extends BaseRepository {
  constructor() {
    super(Employee);
  }

  /**
   * Find active, non-deleted employees scoped to a specific tenant.
   */
  async findActiveByTenant(tenantId, options = {}) {
    return this.find(
      {
        tenantId,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      },
      options
    );
  }

  /**
   * Find employee by email address within a specific tenant.
   */
  async findByEmailAndTenant(email, tenantId, options = {}) {
    return this.findOne({ email, tenantId }, options);
  }
}

module.exports = new EmployeeRepository();
