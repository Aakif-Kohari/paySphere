const Tenant = require('../models/tenant.model');
const User = require('../models/user.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

/**
 * Tenant provisioning (#612).
 *
 * `#585` made `tenantId` the scoping key for every collection in the product
 * and then never wrote one. `Tenant` was imported at the top of
 * `user.controller.js` and referenced nowhere; `signup` built the account
 * without a tenant; `generateTokens` put `tenantId: user.tenantId` —
 * `undefined` — into the JWT; `auth.middleware` copied that onto `req`; and
 * mongoose then removed the key from every filter, turning every scoped read
 * into an unscoped one.
 *
 * This module is the missing step. Every path that can produce or resume a
 * session goes through `ensureTenantForUser`, so an account gets a tenant
 * whether it registers today or logged in for the first time since the
 * migration ran.
 *
 * Two rules the rest of the backend depends on:
 *
 *   1. It is idempotent. Calling it on an account that already has a tenant is
 *      a lookup and nothing else, so putting it on the login path costs one
 *      indexed read.
 *   2. It never throws. A tenant that cannot be provisioned must not take
 *      login down — the caller gets `null`, `req.tenantId` stays unset, and
 *      utils/tenantScope.js then refuses the request with a 403 rather than
 *      letting an unscoped query through. Failing closed is the whole point.
 */

/**
 * The tenant an employee-portal login belongs to.
 *
 * An employee does not own a company: they are a row in someone else's
 * Employee collection, and they belong to whichever tenant that row does. The
 * employer's own account is the fallback for a pre-#585 Employee row that has
 * no `tenantId` of its own yet.
 *
 * @param {object} user a User document with `employeeId` set
 * @returns {Promise<import("mongoose").Types.ObjectId|null>}
 */
async function resolveEmployerTenant(user) {
  const employee = await Employee.findById(user.employeeId)
    .select('tenantId createdBy')
    .lean();

  if (!employee) return null;
  if (employee.tenantId) return employee.tenantId;
  if (!employee.createdBy) return null;

  const owner = await User.findById(employee.createdBy).select('tenantId').lean();

  return owner?.tenantId || null;
}

/**
 * Find or create the tenant for an owner account.
 *
 * `findOne` before `create` rather than an upsert because the tenant name comes
 * from the account's `companyName`, and an upsert would rewrite the name of an
 * existing tenant every time the owner renamed their company in Settings —
 * which is a decision for #612's follow-up, not a side effect of logging in.
 *
 * The `create` is still guarded: `ownerId` is uniquely indexed, so two
 * concurrent logins racing to provision the same account produce one tenant and
 * one E11000, and the loser re-reads the winner's document instead of failing.
 *
 * @param {object} user a User document
 * @returns {Promise<object|null>} the Tenant document, or null if it could not be made
 */
async function findOrCreateTenantForOwner(user) {
  const existing = await Tenant.findOne({ ownerId: user._id });
  if (existing) return existing;

  try {
    return await Tenant.create({
      name: user.companyName || user.fullName || 'Unnamed company',
      ownerId: user._id,
    });
  } catch (error) {
    // Duplicate key: another request provisioned it between the read and the
    // write. Theirs is as good as ours.
    if (error?.code === 11000) {
      return await Tenant.findOne({ ownerId: user._id });
    }
    throw error;
  }
}

/**
 * Give `user` a tenant if it does not have one, and return the id.
 *
 * Safe to call on every login. Returns the existing id untouched when the
 * account is already provisioned, which is the case for everything created
 * after this change and everything the migration has already swept.
 *
 * @param {object|null|undefined} user a User document (not a lean object — it is saved)
 * @returns {Promise<import("mongoose").Types.ObjectId|null>}
 */
async function ensureTenantForUser(user) {
  if (!user || !user._id) return null;
  if (user.tenantId) return user.tenantId;

  try {
    const tenantId = user.employeeId
      ? await resolveEmployerTenant(user)
      : (await findOrCreateTenantForOwner(user))?._id || null;

    if (!tenantId) {
      logger.warn('Could not resolve a tenant for account', {
        userId: String(user._id),
        // An employee login whose Employee row is gone is the one case this
        // legitimately cannot answer, and it is worth seeing in the log.
        employeeId: user.employeeId ? String(user.employeeId) : undefined,
      });
      return null;
    }

    // updateOne rather than save(): this runs on the login path, and the caller
    // may be holding a document selected with a projection. A targeted $set
    // cannot clobber fields that were never loaded.
    await User.updateOne({ _id: user._id }, { $set: { tenantId } });
    user.tenantId = tenantId;

    logger.info('Provisioned tenant for account', {
      userId: String(user._id),
      tenantId: String(tenantId),
    });

    return tenantId;
  } catch (error) {
    // Never break the session over this. tenantScope refuses the request
    // afterwards, which is the safe direction.
    logger.error('Tenant provisioning failed', {
      userId: String(user._id),
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  ensureTenantForUser,
  findOrCreateTenantForOwner,
  resolveEmployerTenant,
};
