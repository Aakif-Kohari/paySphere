/**
 * The GraphQL request context: who is asking, and which company's data they are
 * allowed to see.
 *
 * #539 mounted `/graphql` with no authentication and no tenant scoping, and
 * wrote resolvers that call `Employee.find({})`. An anonymous `POST /graphql`
 * returned every employee and every payroll row belonging to every company in
 * the deployment — names, emails, departments, salary figures (#795).
 *
 * The rest of the product solves this in `middlewares/auth.middleware.js` and
 * `utils/tenantScope.js`, and the fix here is to make GraphQL use the same two
 * answers rather than a second, weaker copy. `expressMiddleware`'s `context`
 * function is the equivalent hook: it runs once per request, before any
 * resolver, and what it throws the client gets instead of data.
 *
 * The resolvers then take `tenantId` from this context and nowhere else. There
 * is deliberately no way for a query to supply one — the reason
 * `utils/tenantScope.js` exists is that mongoose *deletes* an `undefined`
 * filter value rather than matching nothing, so an unscoped read is not an
 * empty result but the entire collection.
 */

const jwt = require('jsonwebtoken');
const { GraphQLError } = require('graphql');
const User = require('../models/user.model');
const { resolveAccountType } = require('../config/accountTypes');
const { ensureTenantForUser } = require('../services/tenant.service');
const { isUsableTenantId } = require('../utils/tenantScope');
const logger = require('../utils/logger');

/**
 * A 401, in the shape Apollo reports errors.
 *
 * `extensions.code` is what a client switches on; `http.status` makes the
 * response status match, so an unauthenticated caller does not get a 200 with an
 * error buried in the body.
 *
 * @param {string} message
 * @returns {GraphQLError}
 */
function unauthenticated(message) {
  return new GraphQLError(message, {
    extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
  });
}

/**
 * A 403 — authenticated, but scoped to nothing.
 *
 * @param {string} message
 * @returns {GraphQLError}
 */
function forbidden(message) {
  return new GraphQLError(message, {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
}

/**
 * Resolve the caller from the Authorization header.
 *
 * Deliberately the same sequence as `auth.middleware.js`, including the two
 * things that are easy to leave out of a second implementation:
 *
 *   - `tokenVersion` is compared, so a token invalidated by a password change or
 *     a sign-out-everywhere is refused here too;
 *   - the tenant comes from the *account*, not from the token claim. Refresh
 *     tokens live seven days, so a session opened before a tenant existed would
 *     otherwise keep carrying `tenantId: undefined` for a week (#612).
 *
 * @param {{ req: import('express').Request }} params
 * @returns {Promise<{userId: string, tenantId: string, accountType: string, user: object}>}
 * @throws {GraphQLError} 401 with no usable token, 403 with no resolvable tenant
 */
async function buildContext({ req }) {
  const header = req?.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    throw unauthenticated('No token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw unauthenticated('Invalid or expired token');
  }

  const user = await User.findById(decoded.id).select(
    '_id isActive tokenVersion role accountType employeeId tenantId companyName fullName',
  );

  if (!user || user.isActive === false) {
    throw unauthenticated('User not found or deactivated');
  }

  if (
    decoded.tokenVersion !== undefined &&
    user.tokenVersion !== undefined &&
    decoded.tokenVersion !== user.tokenVersion
  ) {
    throw unauthenticated('Token is no longer valid');
  }

  const tenantId =
    user.tenantId ||
    (isUsableTenantId(decoded.tenantId) ? decoded.tenantId : null) ||
    (await ensureTenantForUser(user));

  // No tenant means no scope, and an unscoped query here would read the whole
  // collection rather than nothing. Refused, exactly as `requireTenantScope()`
  // refuses it on the REST side.
  if (!isUsableTenantId(tenantId)) {
    logger.warn('GraphQL request refused: no resolvable tenant', {
      userId: String(user._id),
    });

    throw forbidden('Your account is not linked to a company yet');
  }

  return {
    userId: String(user._id),
    tenantId,
    accountType: resolveAccountType(user),
    user,
  };
}

module.exports = { buildContext, unauthenticated, forbidden };
