const AuditLog = require("../models/auditLog.model");
const logger = require("../utils/logger");

const createAuditLog = async ({ userId, action, resourceType, resourceIds, details, result, req }) => {
  try {
    await AuditLog.create({
      userId,
      action,
      resourceType,
      resourceIds: resourceIds || [],
      details: details || {},
      result: result || "success",
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.["user-agent"],
    });
  } catch (error) {
    logger.error("Failed to create audit log", { error: error.message, userId, action });
  }
};

module.exports = { createAuditLog };
