/**
 * Search Controller
 *
 * Handles GET /api/search?q=<term>&index=<employees|payroll|audit-logs>
 *
 * Falls back to an empty result set when Elasticsearch is unavailable so
 * the response contract remains stable regardless of infrastructure state.
 */
'use strict';

const { search, INDICES } = require('../services/elasticsearch.service');

const INDEX_MAP = {
  employees:    INDICES.EMPLOYEES,
  payroll:      INDICES.PAYROLL,
  'audit-logs': INDICES.AUDIT,
};

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function globalSearch(req, res) {
  const q        = (req.query.q || '').trim();
  const indexKey = (req.query.index || 'employees').toLowerCase();

  if (!q) {
    return res.status(400).json({ message: 'Query parameter `q` is required.' });
  }

  const esIndex = INDEX_MAP[indexKey];
  if (!esIndex) {
    return res.status(400).json({
      message: `Unknown index "${indexKey}". Valid values: ${Object.keys(INDEX_MAP).join(', ')}`,
    });
  }

  const results = await search(esIndex, q);
  return res.json({ index: indexKey, query: q, count: results.length, results });
}

module.exports = { globalSearch };
