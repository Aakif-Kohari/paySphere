const Permission = require("../models/permission.model");
const Role = require("../models/role.model");
const User = require("../models/user.model");
const logger = require("../utils/logger");
const {
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  DEFAULT_ROLE,
} = require("../config/permissions");

/**
 * RBAC bootstrap.
 *
 * #391 added the Role/Permission models and the `requirePermission` middleware,
 * but nothing ever created the documents they depend on and nothing ever
 * assigned a role to a user. `requirePermission` denies when `!user.role`, so
 * every guarded route returned 403 for every account (#413).
 *
 * Everything here is idempotent — safe to run on every boot and safe to re-run
 * by hand via `npm run seed`.
 */

/**
 * Create any missing Permission documents. Existing ones keep their `_id` so
 * role references stay valid; only the description is refreshed.
 *
 * @returns {Promise<Map<string, object>>} permission name -> document
 */
async function seedPermissions() {
  const operations = PERMISSION_DEFINITIONS.map((definition) => ({
    updateOne: {
      filter: { name: definition.name },
      update: { $set: { description: definition.description } },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await Permission.bulkWrite(operations, { ordered: false });
  }

  const permissions = await Permission.find({
    name: { $in: PERMISSION_DEFINITIONS.map((d) => d.name) },
  });

  return new Map(permissions.map((p) => [p.name, p]));
}

/**
 * Create any missing Role documents and (re)point them at the permission set
 * declared in config/permissions.js, so editing that file and re-seeding is
 * enough to change what a role can do.
 *
 * @param {Map<string, object>} permissionMap
 * @returns {Promise<Map<string, object>>} role name -> document
 */
async function seedRoles(permissionMap) {
  const operations = ROLE_DEFINITIONS.map((definition) => {
    const permissionIds = definition.permissions
      .map((name) => permissionMap.get(name))
      .filter(Boolean)
      .map((permission) => permission._id);

    if (permissionIds.length !== definition.permissions.length) {
      const missing = definition.permissions.filter(
        (name) => !permissionMap.has(name),
      );
      logger.warn(`Role "${definition.name}" references unknown permissions`, {
        missing,
      });
    }

    return {
      updateOne: {
        filter: { name: definition.name },
        update: { $set: { permissions: permissionIds } },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await Role.bulkWrite(operations, { ordered: false });
  }

  const roles = await Role.find({
    name: { $in: ROLE_DEFINITIONS.map((d) => d.name) },
  });

  return new Map(roles.map((r) => [r.name, r]));
}

/**
 * Backfill accounts created before RBAC landed.
 *
 * Without this, every pre-existing user stays permanently locked out of the
 * employee and report endpoints after upgrading, because `requirePermission`
 * denies on a missing role.
 *
 * @param {Map<string, object>} roleMap
 * @returns {Promise<number>} number of users updated
 */
async function backfillUserRoles(roleMap) {
  const defaultRole = roleMap.get(DEFAULT_ROLE);

  if (!defaultRole) {
    logger.error(
      `Cannot backfill user roles: default role "${DEFAULT_ROLE}" is missing`,
    );
    return 0;
  }

  const result = await User.updateMany(
    { $or: [{ role: { $exists: false } }, { role: null }] },
    { $set: { role: defaultRole._id } },
  );

  const updated = result.modifiedCount || 0;

  if (updated > 0) {
    logger.info(`Backfilled RBAC role for ${updated} existing user(s)`, {
      role: DEFAULT_ROLE,
    });
  }

  return updated;
}

/**
 * Seed permissions, roles, and backfill users that have no role.
 *
 * Never throws: a seeding failure must not stop the server from booting. The
 * middleware degrades gracefully when a role cannot be resolved (see
 * rbac.middleware.js), so a failure here costs authorization granularity, not
 * availability.
 *
 * @returns {Promise<{seeded: boolean, permissions: number, roles: number, usersBackfilled: number, error?: string}>}
 */
async function seedRbac() {
  try {
    const permissionMap = await seedPermissions();
    const roleMap = await seedRoles(permissionMap);
    const usersBackfilled = await backfillUserRoles(roleMap);

    logger.info("RBAC seed complete", {
      permissions: permissionMap.size,
      roles: roleMap.size,
      usersBackfilled,
    });

    return {
      seeded: true,
      permissions: permissionMap.size,
      roles: roleMap.size,
      usersBackfilled,
    };
  } catch (error) {
    logger.error("RBAC seed failed", { error: error.message });
    return {
      seeded: false,
      permissions: 0,
      roles: 0,
      usersBackfilled: 0,
      error: error.message,
    };
  }
}

/**
 * Look up the default role document, used when assigning a role at signup and
 * when the middleware repairs an account that somehow has none.
 *
 * @returns {Promise<object|null>}
 */
async function getDefaultRole() {
  try {
    return await Role.findOne({ name: DEFAULT_ROLE });
  } catch (error) {
    logger.error("Failed to look up the default role", {
      role: DEFAULT_ROLE,
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  seedRbac,
  seedPermissions,
  seedRoles,
  backfillUserRoles,
  getDefaultRole,
};
