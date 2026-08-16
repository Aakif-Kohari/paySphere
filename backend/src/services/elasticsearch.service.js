/**
 * Elasticsearch Service
 *
 * Wraps the official @elastic/elasticsearch client and exposes strongly-typed
 * helpers for indexing and searching PaySphere documents.
 *
 * The client is lazily initialised so that environments where the package is
 * absent (CI without Docker) degrade gracefully instead of crashing at boot.
 *
 * ── #895 ───────────────────────────────────────────────────────────────────
 *
 * That lazy initialisation was correct and was defeated by the line directly
 * under this comment, which used to read `require('./logger')`. The logger
 * lives in `utils/`, not `services/`, so the module threw `MODULE_NOT_FOUND`
 * the moment anything required it — before `getClient` had a chance to degrade
 * anything. `search.controller` requires this, `search.routes` requires that,
 * and `app.js` requires *that*, so a one-word path mistake in an optional
 * integration took the entire API down at boot.
 *
 * The second change here is the `tenantId` filter. `search` used to run a
 * `multi_match` across `fields: ['*']` of a whole index with no filter of any
 * kind, and no caller passed a tenant because there was no parameter for one.
 * Elasticsearch does not have Mongo's "the driver drops an undefined key"
 * excuse (#612) — there was simply no scoping written anywhere, so any
 * authenticated user of any company could type a surname and read another
 * company's employee and payroll records. `tenantId` is now a required
 * argument, and a query without one throws rather than searching everything.
 */
'use strict';

const logger = require('../utils/logger');

const ES_NODE = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

const INDICES = {
  EMPLOYEES: 'paysphere-employees',
  PAYROLL: 'paysphere-payroll',
  AUDIT: 'paysphere-audit-logs',
};

/** Ceiling on `size`, so a caller cannot ask for an index dump in one request. */
const MAX_SIZE = 50;

let _client = null;

/**
 * Thrown when a search or an index write is attempted without a tenant.
 *
 * Carries `status` so error.middleware.js renders it as a 403 rather than a
 * 500: an unscoped search is "you are not scoped to anything", the same answer
 * `utils/tenantScope.js` gives for the Mongo side.
 */
class MissingTenantError extends Error {
  constructor(message = 'A search must be scoped to a company') {
    super(message);
    this.name = 'MissingTenantError';
    this.status = 403;
  }
}

function getClient() {
  if (_client) return _client;
  try {
    const { Client } = require('@elastic/elasticsearch');
    _client = new Client({ node: ES_NODE });
    logger.info('Elasticsearch client initialised', { node: ES_NODE });
  } catch (err) {
    logger.warn('Elasticsearch package unavailable — search degraded', {
      error: err.message,
    });
  }
  return _client;
}

/**
 * Is there a usable Elasticsearch client?
 *
 * Exported so the controller can tell "no matches" apart from "the search
 * backend is not running" in its response. They look identical today — both
 * are an empty array — which makes a misconfigured deployment indistinguishable
 * from a company with no employees.
 *
 * @returns {boolean}
 */
function isSearchAvailable() {
  return Boolean(getClient());
}

/**
 * Reject a tenant reference that cannot scope anything.
 *
 * Rejects the string `'undefined'` as well as the value, because an id
 * interpolated into a template literal somewhere upstream arrives looking like
 * a perfectly good filter term and matches nothing — which in an index write is
 * worse than throwing, since the document is then invisible to its owner and
 * visible to nobody, with no error to explain why.
 *
 * @param {unknown} tenantId
 * @returns {string}
 * @throws {MissingTenantError}
 */
function assertTenant(tenantId) {
  const value =
    tenantId === undefined || tenantId === null ? '' : String(tenantId);

  if (value.trim() === '' || value === 'undefined' || value === 'null') {
    throw new MissingTenantError();
  }

  return value;
}

/**
 * Upsert a document into an Elasticsearch index.
 *
 * `tenantId` is stamped onto the indexed body rather than taken from it, so a
 * caller cannot index a document into another company's scope by putting a
 * different id in `body`.
 *
 * @param {string} index  Target index name (use INDICES constants).
 * @param {string} id     Unique document identifier (MongoDB _id as string).
 * @param {object} body   Fields to index.
 * @param {string} tenantId  The company this document belongs to.
 * @returns {Promise<void>}
 */
async function indexDocument(index, id, body, tenantId) {
  const scope = assertTenant(tenantId);

  const es = getClient();
  if (!es) return;
  try {
    await es.index({ index, id, document: { ...body, tenantId: scope } });
  } catch (err) {
    logger.error('Failed to index document', { index, id, error: err.message });
  }
}

/**
 * Remove a document from an index.
 *
 * Safe to call even if the document does not exist (404 is suppressed).
 *
 * @param {string} index
 * @param {string} id
 * @returns {Promise<void>}
 */
async function removeDocument(index, id) {
  const es = getClient();
  if (!es) return;
  try {
    await es.delete({ index, id, ignore: [404] });
  } catch (err) {
    logger.error('Failed to delete ES document', {
      index,
      id,
      error: err.message,
    });
  }
}

/**
 * Full-text search within one company's slice of an index.
 *
 * Uses the BM25 ranking algorithm native to Elasticsearch. Input is treated as
 * a literal string — no regex interpretation is possible, which closes the
 * ReDoS vulnerability present in the existing Mongoose $regex approach.
 *
 * The `bool` wrapper is what makes the result the caller's own data: `must`
 * ranks, `filter` excludes. `filter` rather than a second `must` deliberately —
 * a filter clause is not scored, so tenancy cannot influence relevance, and it
 * is cacheable.
 *
 * @param {string}  index
 * @param {string}  query        Raw search term from the user.
 * @param {object}  options
 * @param {string}  options.tenantId  Required. The company to search within.
 * @param {number}  [options.size=20] Maximum number of ranked hits, capped at 50.
 * @returns {Promise<object[]>}  Array of matched _source documents with score.
 * @throws {MissingTenantError} when no tenant is given
 */
async function search(index, query, options = {}) {
  const scope = assertTenant(options.tenantId);
  const size = Math.min(
    Math.max(Number.parseInt(options.size, 10) || 20, 1),
    MAX_SIZE,
  );

  const es = getClient();
  if (!es) return [];
  try {
    const result = await es.search({
      index,
      size,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['*'],
                fuzziness: 'AUTO',
                operator: 'or',
              },
            },
          ],
          filter: [{ term: { tenantId: scope } }],
        },
      },
    });
    return result.hits.hits.map((h) => ({
      id: h._id,
      score: h._score,
      ...h._source,
    }));
  } catch (err) {
    // Deliberately not logging `query` any more: it is whatever a user typed
    // into a search box, on an index that holds salaries and email addresses,
    // and the log line was the one place it was written down in plaintext.
    logger.error('Elasticsearch search error', { index, error: err.message });
    return [];
  }
}

module.exports = {
  INDICES,
  MAX_SIZE,
  MissingTenantError,
  isSearchAvailable,
  indexDocument,
  removeDocument,
  search,
};
