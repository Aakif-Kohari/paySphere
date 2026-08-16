const { runWithAuditContext } = require("../utils/auditContext");

/**
 * Seed the AsyncLocalStorage audit context for one request (#724).
 *
 * Mounted at the app level, ahead of the routers. It stores the `req` object
 * itself — not a snapshot — so the model hooks resolve `req.userId` /
 * `req.tenantId` lazily, after `auth.middleware` has stamped them on the
 * per-route auth gate further down the pipeline.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function auditContext(req, res, next) {
  runWithAuditContext(req, next);
}

module.exports = auditContext;
