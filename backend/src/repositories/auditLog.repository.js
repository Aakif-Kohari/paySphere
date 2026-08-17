const BaseRepository = require('./base.repository');
const AuditLog = require('../models/auditLog.model');

/**
 * Concrete AuditLogRepository class handling AuditLog queries.
 */
class AuditLogRepository extends BaseRepository {
  constructor() {
    super(AuditLog);
  }

  /**
   * Fetch paginated audit logs for a tenant, sorted by timestamp descending.
   */
  async findPaginatedLogs(query, skip, limit) {
    return this.find(query, {
      sort: { createdAt: -1 },
      populate: { path: 'userId', select: 'fullName email' },
      skip,
      limit,
      lean: true,
    });
  }

  /**
   * Fetch all matching audit logs up to a limit for export purposes.
   */
  async findExportLogs(query, limit) {
    return this.find(query, {
      sort: { createdAt: -1 },
      limit,
      populate: { path: 'userId', select: 'fullName email' },
      lean: true,
    });
  }
}

module.exports = new AuditLogRepository();
