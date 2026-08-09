/**
 * Elasticsearch Service
 *
 * Wraps the official @elastic/elasticsearch client and exposes strongly-typed
 * helpers for indexing and searching PaySphere documents.
 *
 * The client is lazily initialised so that environments where the package is
 * absent (CI without Docker) degrade gracefully instead of crashing at boot.
 */
'use strict';

const logger = require('./logger');

const ES_NODE = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

const INDICES = {
  EMPLOYEES: 'paysphere-employees',
  PAYROLL:   'paysphere-payroll',
  AUDIT:     'paysphere-audit-logs',
};

let _client = null;

function getClient() {
  if (_client) return _client;
  try {
    const { Client } = require('@elastic/elasticsearch');
    _client = new Client({ node: ES_NODE });
    logger.info('Elasticsearch client initialised', { node: ES_NODE });
  } catch (err) {
    logger.warn('Elasticsearch package unavailable — search degraded', { error: err.message });
  }
  return _client;
}

/**
 * Upsert a document into an Elasticsearch index.
 *
 * @param {string} index  Target index name (use INDICES constants).
 * @param {string} id     Unique document identifier (MongoDB _id as string).
 * @param {object} body   Fields to index.
 * @returns {Promise<void>}
 */
async function indexDocument(index, id, body) {
  const es = getClient();
  if (!es) return;
  try {
    await es.index({ index, id, document: body });
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
    logger.error('Failed to delete ES document', { index, id, error: err.message });
  }
}

/**
 * Full-text search with fuzzy matching across all fields of a single index.
 *
 * Uses the BM25 ranking algorithm native to Elasticsearch.  Input is treated
 * as a literal string — no regex interpretation is possible, which closes the
 * ReDoS vulnerability present in the existing Mongoose $regex approach.
 *
 * @param {string}  index
 * @param {string}  query        Raw search term from the user.
 * @param {number}  [size=20]    Maximum number of ranked hits to return.
 * @returns {Promise<object[]>}  Array of matched _source documents with score.
 */
async function search(index, query, size = 20) {
  const es = getClient();
  if (!es) return [];
  try {
    const result = await es.search({
      index,
      size,
      query: {
        multi_match: {
          query,
          fields: ['*'],
          fuzziness: 'AUTO',
          operator: 'or',
        },
      },
    });
    return result.hits.hits.map((h) => ({ id: h._id, score: h._score, ...h._source }));
  } catch (err) {
    logger.error('Elasticsearch search error', { index, query, error: err.message });
    return [];
  }
}

module.exports = { INDICES, indexDocument, removeDocument, search };
