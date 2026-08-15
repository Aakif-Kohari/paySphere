const roles = {
  admin: ['*'], // Admin has all permissions
  employer: [
    'employee:read', 'employee:write',
    'payroll:read', 'payroll:write',
    'report:read', 'report:write',
    'attendance:read', 'attendance:write'
  ],
  manager: [
    'employee:read',
    'payroll:read',
    'report:read',
    'attendance:read', 'attendance:write'
  ],
  employee: [
    'employee:read',
    'payroll:read',
    'attendance:read'
  ]
};

const checkScope = (userRole, requiredScope) => {
  if (!userRole) return false;
  const userScopes = roles[userRole] || [];
  
  if (userScopes.includes('*')) return true;
  
  // Exact match
  if (userScopes.includes(requiredScope)) return true;
  
  // Wildcard match (e.g., employee:* matches employee:write)
  const [resource, action] = requiredScope.split(':');
  if (userScopes.includes(`${resource}:*`)) return true;
  
  return false;
};

const requireScope = (requiredScope) => {
  return (req, res, next) => {
    try {
      // Assuming req.userRole is populated by auth middleware
      // If not, we fallback to 'employer' for backward compatibility
      // In a real scenario, User model should have a role field
      const userRole = req.userRole || 'employer'; 
      
      if (!checkScope(userRole, requiredScope)) {
        return res.status(403).json({ 
          message: `Forbidden: Requires '${requiredScope}' scope.`,
          error: "INSUFFICIENT_PERMISSIONS"
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ message: "Error checking permissions" });
    }
  };
};

module.exports = { requireScope, roles, checkScope };
