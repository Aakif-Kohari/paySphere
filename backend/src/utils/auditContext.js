const { AsyncLocalStorage } = require('async_hooks');

/**
 * Request-scoped storage for the audit trail (#724).
 *
 * `createAuditLog` is called from inside Mongoose document/query middleware,
 * which has no reference to the Express `req`. Before this file, the only way
 * an audit entry knew who did something was the controller explicitly passing
 * `req` to `eventBus.emit('AUDIT_LOG', ...)` at each of the forty-odd emit
 * sites. The middleware in `middlewares/auditTrail.middleware.js` intercepts
 * writes automatically, and needs the same facts — actor, company, IP, user
 * agent — without a controller hand-off. AsyncLocalStorage makes them
 * available to any code running inside the request's async context.
 *
 * The store holds the *live* `req` object rather than a snapshot of its
 * fields. That matters because auth is applied per-route (`auth.middleware`)
 * while this context is seeded at the app level: `req.userId` and
 * `req.tenantId` are stamped by `auth.middleware` *after* the `run()` begins,
 * and the model hooks read them lazily at write time.
 */
const auditContextStore = new AsyncLocalStorage();

/**
 * Run `fn` with the request's audit context available to `getAuditContext`.
 *
 * @param {object} req the Express request
 * @param {Function} fn the rest of the request pipeline
 * @returns {*} whatever `fn` returns (promise-aware via AsyncLocalStorage)
 */
function runWithAuditContext(req, fn) {
  return auditContextStore.run({ req }, fn);
}

/**
 * The audit context for the current async execution, or undefined when none.
 *
 * @returns {{ req: object } | undefined}
 */
function getAuditContext() {
  return auditContextStore.getStore();
}

module.exports = { runWithAuditContext, getAuditContext };
