const AuditLog = require("../models/auditLog.model");
const { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } = require("../models/auditLog.model");
const { isUsableTenantId } = require("../utils/tenantScope");
const logger = require("../utils/logger");

/**
 * Write one audit entry.
 *
 * Never throws. Audit logging is fire-and-forget by design (#390): controllers
 * call it *after* their mutation has committed, so an exception here would
 * surface as a 500 for an operation that actually succeeded.
 *
 * "Never throws" is not the same as "never complains", and #664 is what happens
 * when the two get confused — a dropped write used to be one `logger.error`
 * carrying the driver's message and nothing else. The rejections below are
 * logged with enough context to find the emit site that caused them.
 *
 * @param {object} payload
 * @param {string} payload.userId the actor
 * @param {string} [payload.tenantId] the company; falls back to `req.tenantId`
 * @param {string} payload.action one of AUDIT_ACTIONS
 * @param {string} payload.resourceType one of AUDIT_RESOURCE_TYPES
 * @param {Array} [payload.resourceIds]
 * @param {object} [payload.details]
 * @param {string} [payload.result] success | failure | partial
 * @param {object} [payload.req] the Express request, for tenant, IP and UA
 * @returns {Promise<boolean>} whether the entry was written
 */
const createAuditLog = async ({
  userId,
  tenantId,
  action,
  resourceType,
  resourceIds,
  details,
  result,
  req,
}) => {
  // Every emit site already passes `req`, and auth.middleware stamps
  // `req.tenantId` onto it — so the tenant is available without touching the
  // thirty-three call sites. An explicit `tenantId` wins, for anything that
  // audits without a request behind it.
  const resolvedTenantId = isUsableTenantId(tenantId) ? tenantId : req?.tenantId;

  if (!isUsableTenantId(resolvedTenantId)) {
    logger.error("Audit entry dropped: no tenant on the request", {
      userId: userId ? String(userId) : undefined,
      action,
      resourceType,
    });
    return false;
  }

  // Checked here rather than left to the schema so the log line names the
  // offending value. Mongoose's ValidationError says "`X` is not a valid enum
  // value for path `action`" and leaves you grepping for who emitted it.
  if (!AUDIT_ACTIONS.includes(action)) {
    logger.error("Audit entry dropped: unknown action", {
      action,
      resourceType,
      userId: userId ? String(userId) : undefined,
      hint: "Add it to AUDIT_ACTIONS in models/auditLog.model.js",
    });
    return false;
  }

  if (!AUDIT_RESOURCE_TYPES.includes(resourceType)) {
    logger.error("Audit entry dropped: unknown resource type", {
      action,
      resourceType,
      userId: userId ? String(userId) : undefined,
      hint: "Add it to AUDIT_RESOURCE_TYPES in models/auditLog.model.js",
    });
    return false;
  }

  try {
    await AuditLog.create({
      userId,
      tenantId: resolvedTenantId,
      action,
      resourceType,
      resourceIds: resourceIds || [],
      details: details || {},
      result: result || "success",
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.["user-agent"],
    });

    return true;
  } catch (error) {
    logger.error("Failed to create audit log", {
      error: error.message,
      userId: userId ? String(userId) : undefined,
      action,
      resourceType,
    });
    return false;
  }
};

module.exports = { createAuditLog };
