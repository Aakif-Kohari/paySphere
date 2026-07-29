const User = require("../models/user.model");
const Role = require("../models/role.model");

/**
 * Middleware to check if the authenticated user has a specific permission.
 * Requires auth middleware to run before it (so req.userId is set).
 */
const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Find user and populate their role and its permissions
      const user = await User.findById(req.userId).populate({
        path: 'role',
        populate: {
          path: 'permissions',
          model: 'Permission'
        }
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If user has no role or role has no permissions, deny access
      if (!user.role || !user.role.permissions) {
        return res.status(403).json({ message: "Access denied. No role assigned." });
      }

      // Check if the user's role contains the required permission
      const hasPermission = user.role.permissions.some(
        (perm) => perm.name === requiredPermission
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Access denied. Requires permission: ${requiredPermission}` 
        });
      }

      // Proceed to the next middleware/controller
      next();
    } catch (error) {
      console.error("RBAC Middleware Error:", error);
      res.status(500).json({ message: "Internal server error during authorization check" });
    }
  };
};

module.exports = { requirePermission };
