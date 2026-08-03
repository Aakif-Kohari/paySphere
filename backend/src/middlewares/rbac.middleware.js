const User = require("../models/user.model");
const logger = require("../utils/logger");
const { getDefaultRole } = require("../seeds/rbac.seed");
const { resolveAccountType } = require("../config/accountTypes");

/**
 * When true, an account whose role cannot be resolved is denied instead of
 * being repaired. Off by default — see the note in `resolveRole` below.
 */
const STRICT_MODE = process.env.RBAC_STRICT === "true";

/**
 * Resolve the caller's role, repairing the account if it has none.
 */
async function resolveRole(userId) {
  const user = await User.findById(userId).populate({
    path: "role",
    populate: { path: "permissions", model: "Permission" },
  });

  if (!user) {
    return { role: null, repaired: false, missingUser: true };
  }

  if (user.role && Array.isArray(user.role.permissions)) {
    return { role: user.role, repaired: false };
  }

  // No role assigned — either a pre-RBAC account or a failed seed.
  const defaultRole = await getDefaultRole();

  if (!defaultRole) {
    logger.error(
      "No role assigned and the default role is missing. Has the RBAC seed run?",
      { userId },
    );
    return { role: null, repaired: false };
  }

  await User.updateOne({ _id: userId }, { $set: { role: defaultRole._id } });
  logger.warn("Assigned the default role to an account that had none", {
    userId,
    role: defaultRole.name,
  });

  const repaired = await User.findById(userId).populate({
    path: "role",
    populate: { path: "permissions", model: "Permission" },
  });

  return { role: repaired?.role || null, repaired: true };
}

/**
 * Middleware asserting that the authenticated user holds a given permission.
 * Requires `auth` to have run first so `req.userId` is populated.
 *
 * @param {string} requiredPermission e.g. "WRITE_PAYROLL"
 */
const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { role, missingUser } = await resolveRole(req.userId);

      if (missingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!role) {
        if (STRICT_MODE) {
          return res
            .status(403)
            .json({ message: "Access denied. No role assigned." });
        }

        logger.warn(
          "Permission check bypassed: role could not be resolved. Run `npm run seed`.",
          { userId: req.userId, requiredPermission },
        );
        return next();
      }

      const hasPermission = role.permissions.some(
        (perm) => perm && perm.name === requiredPermission,
      );

      if (!hasPermission) {
        logger.warn("Permission denied", {
          userId: req.userId,
          role: role.name,
          requiredPermission,
        });
        return res.status(403).json({
          message: `Access denied. Requires permission: ${requiredPermission}`,
        });
      }

      req.userRole = role.name;
      next();
    } catch (error) {
      logger.error("RBAC middleware error", {
        userId: req.userId,
        requiredPermission,
        error: error.message,
      });
      res
        .status(500)
        .json({ message: "Internal server error during authorization check" });
    }
  };
};

/**
 * Account-type gate, for routes that are about *which console you are in*
 * rather than *which permission you hold* — the self-service portal, mainly.
 *
 * Previously this read `req.user.role` and fell back to the literal "ADMIN":
 *
 *     const userRole = (req.user && req.user.role) || req.userRole || "ADMIN";
 *
 * Two problems. `req.user.role` is the RBAC role reference, not an account
 * type, so on a repaired database it is an ObjectId that matches neither
 * "ADMIN" nor "EMPLOYEE". And the fallback is fail-open: an account whose type
 * could not be determined was handed the most privileged one, which for an
 * authorization check is backwards. It now resolves from the account itself and
 * denies when it cannot tell (#558).
 *
 * @param {...string} allowedTypes ACCOUNT_TYPE values; empty means "any signed-in account"
 */
const authorize = (...allowedTypes) => {
  return (req, res, next) => {
    if (!req.user && !req.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (allowedTypes.length === 0) return next();

    // `req.accountType` is stamped by the auth middleware. Resolving again from
    // `req.user` keeps the guard correct when it is mounted without it, or in a
    // test that builds the request by hand.
    const accountType = req.accountType || resolveAccountType(req.user);

    if (!accountType || !allowedTypes.includes(accountType)) {
      return res.status(403).json({ message: "Access denied. Insufficient permissions." });
    }

    next();
  };
};

module.exports = authorize;
module.exports.authorize = authorize;
module.exports.requirePermission = requirePermission;
module.exports.resolveRole = resolveRole;
module.exports.STRICT_MODE = STRICT_MODE;
