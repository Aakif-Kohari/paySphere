const auditLogRepository = require('../repositories/auditLog.repository');
const { AUDIT_ACTIONS } = require('../models/auditLog.model');
const { tenantFilter } = require('../utils/tenantScope');

/**
 * Reading the audit trail (#664).
 *
 * Both handlers filtered on `{ userId: req.userId }` and nothing else, so what
 * came back was the caller's own actions — a personal diary rather than a
 * company audit trail. An owner reviewing a payroll run saw only the half they
 * performed themselves; the HR manager who submitted it and the second approver
 * who signed it off were both invisible to them.
 *
 * The filter is the tenant now. `?actor=<userId>` narrows it back to one person
 * for the cases where that is genuinely what you want.
 */

/** The most rows one page may return. */
const MAX_PAGE_SIZE = 100;

/** The default page size, unchanged. */
const DEFAULT_PAGE_SIZE = 50;

/**
 * The most rows one CSV export may contain.
 *
 * The export had no bound at all: `AuditLog.find(query)` with no `limit`, every
 * document hydrated into a mongoose model and held in memory while the CSV
 * string is built. On a busy tenant a year of payroll activity is a lot of
 * documents to load to answer one request.
 */
const MAX_EXPORT_ROWS = 10000;

/**
 * The `{ $gte, $lte }` clause for an optional date range, or null.
 *
 * An unparseable date used to fall through to `new Date("nonsense")`, which is
 * an Invalid Date — mongoose then casts it and throws, so a typo in a query
 * string was a 500.
 *
 * @param {object} query the request query string
 * @returns {{ok: true, range: object|null} | {ok: false, message: string}}
 */
function parseDateRange({ startDate, endDate, days }) {
  if (startDate || endDate) {
    const range = {};

    if (startDate) {
      const from = new Date(startDate);
      if (isNaN(from.getTime())) {
        return { ok: false, message: 'Invalid startDate format' };
      }
      range.$gte = from;
    }

    if (endDate) {
      const to = new Date(endDate);
      if (isNaN(to.getTime())) {
        return { ok: false, message: 'Invalid endDate format' };
      }
      range.$lte = to;
    }

    if (range.$gte && range.$lte && range.$gte > range.$lte) {
      return { ok: false, message: 'startDate must be on or before endDate' };
    }

    return { ok: true, range };
  }

  if (days) {
    const daysNum = parseInt(days, 10);

    if (isNaN(daysNum) || daysNum <= 0) {
      return { ok: false, message: 'days must be a positive integer' };
    }

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - daysNum);

    return { ok: true, range: { $gte: pastDate } };
  }

  return { ok: true, range: null };
}

/**
 * Build the scoped query for both handlers.
 *
 * @param {object} req
 * @returns {{ok: true, query: object} | {ok: false, message: string}}
 */
function buildQuery(req) {
  // Throws MissingTenantError rather than handing back `{}` — see
  // utils/tenantScope.js for why an unscoped audit query is the dangerous case.
  const query = tenantFilter(req);

  const parsed = parseDateRange(req.query);
  if (!parsed.ok) return parsed;
  if (parsed.range) query.createdAt = parsed.range;

  // Narrow to one actor. `?actor=me` is the old behaviour, kept because the
  // Settings page's "my recent activity" panel wants exactly that.
  if (req.query.actor) {
    query.userId = req.query.actor === 'me' ? req.userId : req.query.actor;
  }

  if (req.query.action) {
    if (!AUDIT_ACTIONS.includes(req.query.action)) {
      return { ok: false, message: `Unknown action: ${req.query.action}` };
    }
    query.action = req.query.action;
  }

  return { ok: true, query };
}

exports.getAuditLogs = async (req, res, next) => {
  try {
    const built = buildQuery(req);
    if (!built.ok) return res.error(built.message, null, 'bad_request', 400);

    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 50;

    if (typeof MAX_PAGE_SIZE !== 'undefined' && limit > MAX_PAGE_SIZE) {
      limit = MAX_PAGE_SIZE;
    }

    const skip = (page - 1) * limit;

    // The count and the page in parallel: they are independent
    const [logs, totalLogs] = await Promise.all([
      auditLogRepository.findPaginatedLogs(built.query, skip, limit),
      auditLogRepository.countDocuments(built.query),
    ]);

    const processedLogs = logs.map((log) => ({
      ...log,
      userId: log.userId || { fullName: 'Deleted User', email: '' },
    }));

    // Return a metadata object containing totalRecords and totalPages
    res.success({
      logs: processedLogs,
      metadata: {
        totalRecords: totalLogs,
        totalPages: Math.ceil(totalLogs / limit) || 1,
        currentPage: page,
        pageSize: limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

// EXPORT AUDIT LOGS TO CSV
exports.exportAuditLogsCSV = async (req, res, next) => {
  try {
    const built = buildQuery(req);
    if (!built.ok) return res.error(built.message, null, 'bad_request', 400);

    const logs = await auditLogRepository.findExportLogs(built.query, MAX_EXPORT_ROWS);

    const header = [
      'Timestamp',
      'Actor',
      'Actor Email',
      'Action',
      'Resource Type',
      'Resource IDs',
      'Result',
      'Details',
      'IP Address',
      'User Agent',
    ];

    const escapeCsvField = (value) => {
      if (value === undefined || value === null) return '';
      let str =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map((log) => {
      const actor = log.userId || { fullName: 'Deleted User', email: '' };
      return [
        escapeCsvField(
          log.createdAt ? new Date(log.createdAt).toISOString() : '',
        ),
        escapeCsvField(actor.fullName),
        escapeCsvField(actor.email),
        escapeCsvField(log.action || ''),
        escapeCsvField(log.resourceType || ''),
        escapeCsvField(
          Array.isArray(log.resourceIds)
            ? log.resourceIds.join('; ')
            : log.resourceIds || '',
        ),
        escapeCsvField(log.result || 'success'),
        escapeCsvField(log.details || {}),
        escapeCsvField(log.ipAddress || log.ip || ''),
        escapeCsvField(log.userAgent || ''),
      ];
    });

    const csvContent = [
      header.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`,
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

exports.MAX_PAGE_SIZE = MAX_PAGE_SIZE;
exports.DEFAULT_PAGE_SIZE = DEFAULT_PAGE_SIZE;
exports.MAX_EXPORT_ROWS = MAX_EXPORT_ROWS;
exports.parseDateRange = parseDateRange;
