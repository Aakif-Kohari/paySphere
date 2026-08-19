/**
 * Search Controller
 *
 * Handles GET /api/search?q=<term>&index=<employees|payroll>
 *
 * Falls back to an empty result set when Elasticsearch is unavailable so
 * the response contract remains stable regardless of infrastructure state —
 * but says so in the response, because "the search cluster is not running" and
 * "this company has nobody called Priya" used to be the same answer.
 */
'use strict';

const {
  search,
  isSearchAvailable,
  INDICES,
} = require('../services/elasticsearch.service');
const { getTenantId } = require('../utils/tenantScope');
const { PERMISSIONS } = require('../config/permissions');

/**
 * The indices a caller may search, and the permission each one requires.
 *
 * Keyed on the permission that guards the *same data at its own endpoint*, so
 * choosing an index can never read something the equivalent REST route would
 * refuse. Without this, `?index=payroll` was a way for any token holder to
 * full-text search salary data while `GET /api/payroll` sat behind
 * `READ_PAYROLL` (#895).
 *
 * `audit-logs` is deliberately absent. `INDICES.AUDIT` still exists for the
 * write side, but there is no permission in the RBAC catalogue that means "may
 * read the audit log" — `GET /api/audit-logs` is itself ungated — and inventing
 * one inside a search fix would put the definition of an access-control
 * boundary in the wrong place. An index of every action every user has taken
 * should not become full-text searchable by every token holder as a side effect
 * of repairing a boot error. Restoring it belongs with gating the audit routes,
 * which is its own change.
 */
const SEARCHABLE_INDICES = {
  employees: {
    index: INDICES.EMPLOYEES,
    permission: PERMISSIONS.READ_EMPLOYEE,
  },
  payroll: {
    index: INDICES.PAYROLL,
    permission: PERMISSIONS.READ_PAYROLL,
  },
};

const VALID_INDEX_KEYS = Object.keys(SEARCHABLE_INDICES);

/** Longest term we will hand to Elasticsearch. */
const MAX_QUERY_LENGTH = 200;

/**
 * The index key a request is asking for, normalised.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function indexKeyOf(req) {
  return String(req?.query?.index || 'employees')
    .trim()
    .toLowerCase();
}

/**
 * The permission a request needs, given the index it names.
 *
 * Exported for `search.routes.js`, which turns it into a gate. The permission
 * cannot be decided at mount time because it depends on a query parameter, so
 * the route asks this and delegates to the ordinary `requirePermission`
 * middleware — one implementation of the permission check, not two.
 *
 * @param {import('express').Request} req
 * @returns {string|null} null when the index is not searchable
 */
function permissionForRequest(req) {
  return SEARCHABLE_INDICES[indexKeyOf(req)]?.permission || null;
}

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function globalSearch(req, res) {
  // Answered here rather than by letting `requireTenant` throw. Its
  // `MissingTenantError` carries `status = 403`, but error.middleware.js reads
  // `err.statusCode` and defaults it to 500 — so the throw renders as a server
  // error, which is the wrong thing to tell a caller whose account is simply
  // not linked to a company yet. The route mounts `requireTenantScope()` too;
  // this is what makes the handler correct read on its own.
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(403).json({
      message:
        'Your account is not linked to a company yet. Sign in again to continue.',
    });
  }

  const q = String(req.query.q || '').trim();
  const indexKey = indexKeyOf(req);

  if (!q) {
    return res
      .status(400)
      .json({ message: 'Query parameter `q` is required.' });
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      message: `Query parameter \`q\` must be ${MAX_QUERY_LENGTH} characters or fewer.`,
    });
  }

  const target = SEARCHABLE_INDICES[indexKey];
  if (!target) {
    return res.status(400).json({
      message: `Unknown index "${indexKey}". Valid values: ${VALID_INDEX_KEYS.join(', ')}`,
    });
  }

  const results = await search(target.index, q, {
    tenantId,
    size: req.query.size,
  });

  return res.json({
    index: indexKey,
    query: q,
    count: results.length,
    // An empty list from a cluster that is not running is not the same claim as
    // an empty list from one that is, and a caller has no other way to tell.
    available: isSearchAvailable(),
    results,
  });
}

module.exports = {
  globalSearch,
  permissionForRequest,
  SEARCHABLE_INDICES,
  VALID_INDEX_KEYS,
  MAX_QUERY_LENGTH,
};
