const AuditLog = require("../models/auditLog.model");

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
    console.error("Failed to create audit log:", error);
  }
};

module.exports = { createAuditLog };
