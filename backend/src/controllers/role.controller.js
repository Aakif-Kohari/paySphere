const mongoose = require("mongoose");
const Role = require("../models/role.model");
const Permission = require("../models/permission.model");
const User = require("../models/user.model");
const eventBus = require("../services/event.service");
const logger = require("../utils/logger");
const { ROLES } = require("../config/permissions");

/**
 * Custom role management (#475).
 *
 * A role is a set of `Permission` names, and the RBAC middleware derives every
 * account's authority from its role — so each of these handlers is a security
 * mutation: creating a role grants capabilities, deleting one revokes them from
 * whoever holds it, editing one reassigns them. Everything here therefore
 * validates explicitly, resolves permission names against the canonical
 * vocabulary, refuses to touch the seeded system roles, and emits an audit
 * event.
 *
 * Roles are intentionally not tenant-scoped: the `Role` collection is shared by
 * design (the seeder writes the same three documents for every database), and a
 * role's name is what appears in the permissions UI.
 */

const MAX_NAME_LENGTH = 50;

/**
 * The roles the seeder maintains. They are re-created and re-pointed at the
 * vocabulary in config/permissions.js on every boot, so any edit or delete from
 * this API would be silently reverted — and editing the default role (#475's
 * hard requirement) would hand out whatever the seeder restores. They are
 * protected here so the API does not pretend an action that will not stick is
 * possible.
 */
const SYSTEM_ROLE_NAMES = new Set(Object.values(ROLES));

/**
 * @param {object} role a role document or lean object
 * @returns {boolean} whether the role is one the seeder maintains
 */
function isSystemRole(role) {
  return Boolean(role && SYSTEM_ROLE_NAMES.has(role.name));
}

/**
 * Validate a role name for create/update.
 *
 * @param {unknown} name
 * @returns {{ok: true, name: string} | {ok: false, message: string}}
 */
function validateRoleName(name) {
  if (typeof name !== "string") {
    return { ok: false, message: "name must be a string" };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "name is required" };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      message: `name cannot exceed ${MAX_NAME_LENGTH} characters`,
    };
  }
  return { ok: true, name: trimmed };
}

/**
 * Resolve an array of permission names to their Permission documents.
 *
 * The API takes names (not ids) because that is what the permission matrix in
 * the UI renders, and the vocabulary in config/permissions.js is the single
 * source of truth. Names are validated against the database so a typo cannot
 * silently create a role whose permissions only partially resolve.
 *
 * @param {unknown} names
 * @returns {Promise<{ok: true, permissions: object[]} | {ok: false, message: string}>}
 */
async function resolvePermissions(names) {
  if (!Array.isArray(names) || names.length === 0) {
    return {
      ok: false,
      message: "permissions must be a non-empty array of permission names",
    };
  }

  const unique = [...new Set(names)];
  const docs = await Permission.find({ name: { $in: unique } }).lean();

  const found = new Set(docs.map((d) => d.name));
  const missing = unique.filter((name) => !found.has(name));

  if (missing.length > 0) {
    return { ok: false, message: `unknown permissions: ${missing.join(", ")}` };
  }

  return { ok: true, permissions: docs };
}

/**
 * Get the roles plus the permission catalog in one response.
 *
 * The matrix UI needs every permission to render its checkboxes and every role
 * to render its grant, so the list endpoint returns both — one round trip, and
 * the two can never disagree about what a permission is called.
 */
exports.getRoles = async (req, res, next) => {
  try {
    const [roles, permissions, counts] = await Promise.all([
      Role.find().sort("name").populate("permissions", "name description").lean(),
      Permission.find().sort("name").lean(),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    ]);

    const countByRole = new Map(counts.map((c) => [String(c._id), c.count]));

    res.status(200).json({
      roles: roles.map((role) => ({
        ...role,
        isSystem: isSystemRole(role),
        userCount: countByRole.get(String(role._id)) || 0,
      })),
      permissions,
    });
  } catch (error) {
    next(error);
  }
};

exports.createRole = async (req, res, next) => {
  try {
    const { name, permissions } = req.body || {};

    const nameCheck = validateRoleName(name);
    if (!nameCheck.ok) {
      return res.status(400).json({ message: nameCheck.message });
    }

    const permissionCheck = await resolvePermissions(permissions);
    if (!permissionCheck.ok) {
      return res.status(400).json({ message: permissionCheck.message });
    }

    // The unique index on `name` is the real backstop; this pre-check turns
    // E11000 into a readable 409 instead of a 500.
    const existing = await Role.findOne({ name: nameCheck.name }).lean();
    if (existing) {
      return res
        .status(409)
        .json({ message: `A role named "${nameCheck.name}" already exists` });
    }

    const role = new Role({
      name: nameCheck.name,
      permissions: permissionCheck.permissions.map((p) => p._id),
    });

    await role.save();

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: "ROLE_CREATE",
      resourceType: "Role",
      resourceIds: [role._id],
      details: { name: role.name, permissions: permissionCheck.permissions.map((p) => p.name) },
      req,
    });

    logger.info("Custom role created", {
      roleId: String(role._id),
      name: role.name,
      userId: req.userId,
    });

    res.status(201).json({
      ...role.toObject(),
      isSystem: false,
      userCount: 0,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: "A role with that name already exists" });
    }
    next(error);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid role id format" });
    }

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    if (isSystemRole(role)) {
      return res.status(409).json({
        message: "System roles cannot be modified. Create a custom role instead.",
      });
    }

    const { name, permissions } = req.body || {};

    let newName = role.name;
    let newPermissionIds = role.permissions;
    let auditPermissionNames = [];

    if (name !== undefined) {
      const nameCheck = validateRoleName(name);
      if (!nameCheck.ok) {
        return res.status(400).json({ message: nameCheck.message });
      }
      newName = nameCheck.name;
    }

    if (permissions !== undefined) {
      const permissionCheck = await resolvePermissions(permissions);
      if (!permissionCheck.ok) {
        return res.status(400).json({ message: permissionCheck.message });
      }
      newPermissionIds = permissionCheck.permissions.map((p) => p._id);
      auditPermissionNames = permissionCheck.permissions.map((p) => p.name);
    }

    if (name === undefined && permissions === undefined) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    if (newName !== role.name) {
      const conflict = await Role.findOne({ name: newName }).lean();
      if (conflict) {
        return res
          .status(409)
          .json({ message: `A role named "${newName}" already exists` });
      }
    }

    role.name = newName;
    role.permissions = newPermissionIds;
    await role.save();

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: "ROLE_UPDATE",
      resourceType: "Role",
      resourceIds: [role._id],
      details: { name: role.name, permissions: auditPermissionNames },
      req,
    });

    logger.info("Custom role updated", {
      roleId: String(role._id),
      name: role.name,
      userId: req.userId,
    });

    const updated = await Role.findById(role._id)
      .populate("permissions", "name description")
      .lean();

    res.status(200).json({ ...updated, isSystem: false });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: "A role with that name already exists" });
    }
    next(error);
  }
};

exports.deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid role id format" });
    }

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    if (isSystemRole(role)) {
      return res.status(409).json({
        message: "System roles cannot be deleted. Create a custom role instead.",
      });
    }

    const usersWithRole = await User.countDocuments({ role: role._id });
    if (usersWithRole > 0) {
      return res.status(409).json({
        message: `This role is assigned to ${usersWithRole} user(s) and cannot be deleted. Reassign them first.`,
      });
    }

    await Role.deleteOne({ _id: role._id });

    eventBus.emit("AUDIT_LOG", {
      userId: req.userId,
      action: "ROLE_DELETE",
      resourceType: "Role",
      resourceIds: [role._id],
      details: { name: role.name },
      req,
    });

    logger.info("Custom role deleted", {
      roleId: String(role._id),
      name: role.name,
      userId: req.userId,
    });

    res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    next(error);
  }
};

exports.SYSTEM_ROLE_NAMES = SYSTEM_ROLE_NAMES;
exports.isSystemRole = isSystemRole;
exports.validateRoleName = validateRoleName;
exports.resolvePermissions = resolvePermissions;
