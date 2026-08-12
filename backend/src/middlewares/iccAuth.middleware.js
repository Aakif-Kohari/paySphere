/**
 * @fileoverview ICC Authorization Middleware
 * @description Bypasses standard RBAC to strictly enforce POSH confidentiality.
 * Only active ICC members can access grievance endpoints. Tenant Admins are explicitly blocked.
 * Issue: #958
 */
const { ICCCommittee } = require('../models/grievance.model');
const logger = require('../utils/logger');

/**
 * Middleware to verify the user is an active ICC member for the tenant.
 * Anti-Retaliation: Explicitly denies access to standard Admin/HR roles.
 */
async function requireICC(req, res, next) {
    try {
        if (!req.userId || !req.tenantId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const iccMembership = await ICCCommittee.findOne({
            tenantId: req.tenantId,
            userId: req.userId,
            isActive: true
        });

        if (!iccMembership) {
            // Log the unauthorized access attempt for audit purposes
            logger.warn('Unauthorized POSH access attempt', {
                userId: req.userId,
                tenantId: req.tenantId,
                ip: req.ip,
                path: req.originalUrl
            });

            return res.status(403).json({
                message: 'Forbidden: Access restricted to Internal Complaints Committee (ICC) members only.'
            });
        }

        // Attach ICC role to request for controller use
        req.iccRole = iccMembership.role;
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = requireICC;
