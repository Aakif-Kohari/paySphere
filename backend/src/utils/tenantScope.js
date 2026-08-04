const mongoose = require('mongoose');

/**
 * Building tenant-scoped query filters, and refusing to build one without a
 * tenant (#612).
 *
 * The bug this exists to prevent is not "someone forgot a filter". It is that
 * mongoose deletes `undefined` values out of a query object before the driver
 * ever sees it:
 *
 *     Employee.find({ tenantId: undefined, deletedAt: null }).getFilter()
 *     // => { deletedAt: null }
 *
 *     Employee.find({ tenantId: undefined }).getFilter()
 *     // => {}
 *
 * So a missing tenant does not produce an empty result set or an error. It
 * produces *every row in the collection, for every customer*, and it does so
 * silently — the endpoint returns 200 and the response looks plausible. That is
 * how #585 shipped a cross-account read on `GET /api/employees` without anyone
 * noticing.
 *
 * Every scoped query therefore goes through `tenantFilter(req)`, which throws
 * rather than hands back `{}`. A controller that has lost its tenant returns
 * 403 instead of the database.
 */

/**
 * Thrown when a scoped query is attempted without a resolvable tenant.
 *
 * Carries `status` so error.middleware.js turns it into a 403 rather than the
 * generic 500 — this is "you are not scoped to anything", not "we crashed".
 */
class MissingTenantError extends Error {
  constructor(message = 'Request is not scoped to a company') {
    super(message);
    this.name = 'MissingTenantError';
    this.status = 403;
  }
}

/**
 * Is this a usable tenant reference?
 *
 * Rejects `undefined`, `null`, `""` and the string `"undefined"` — the last of
 * which is what you get when an id is interpolated into a template literal
 * somewhere upstream, and is exactly the kind of value that would otherwise
 * cast cleanly enough to look fine.
 *
 * @param {unknown} tenantId
 * @returns {boolean}
 */
function isUsableTenantId(tenantId) {
  if (tenantId === undefined || tenantId === null) return false;
  if (typeof tenantId === 'string' && tenantId.trim() === '') return false;
  if (tenantId === 'undefined' || tenantId === 'null') return false;

  return mongoose.Types.ObjectId.isValid(tenantId);
}

/**
 * The tenant this request is scoped to.
 *
 * @param {object} req an Express request that has been through auth.middleware
 * @returns {import("mongoose").Types.ObjectId|string|null}
 */
function getTenantId(req) {
  return isUsableTenantId(req?.tenantId) ? req.tenantId : null;
}

/**
 * Assert that the request is scoped, and return the tenant id.
 *
 * @param {object} req
 * @returns {import("mongoose").Types.ObjectId|string}
 * @throws {MissingTenantError} when no tenant is resolvable
 */
function requireTenant(req) {
  const tenantId = getTenantId(req);
  if (!tenantId) throw new MissingTenantError();

  return tenantId;
}

/**
 * Build a query filter scoped to the request's tenant.
 *
 * Use this everywhere `{ tenantId: req.tenantId }` appears today. The tenant key
 * is applied *after* the spread so a caller cannot widen the scope by passing
 * their own `tenantId` — `tenantFilter(req, req.query)` is safe.
 *
 * @param {object} req
 * @param {object} [extra] additional filter clauses
 * @returns {object}
 * @throws {MissingTenantError} when no tenant is resolvable
 */
function tenantFilter(req, extra = {}) {
  const tenantId = requireTenant(req);

  return { ...extra, tenantId };
}

/**
 * Express guard for routers whose every handler is tenant-scoped.
 *
 * Mount after `auth`. Cheaper than remembering to call `requireTenant` in
 * fourteen handlers, and it fails at the edge instead of halfway through one.
 *
 * @returns {import("express").RequestHandler}
 */
function requireTenantScope() {
  return (req, res, next) => {
    if (!getTenantId(req)) {
      return res.status(403).json({
        message:
          'Your account is not linked to a company yet. Sign in again to continue.',
      });
    }

    next();
  };
}

module.exports = {
  MissingTenantError,
  isUsableTenantId,
  getTenantId,
  requireTenant,
  tenantFilter,
  requireTenantScope,
};
