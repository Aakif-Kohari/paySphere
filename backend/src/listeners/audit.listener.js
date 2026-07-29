const eventBus = require("../services/event.service");
const { createAuditLog } = require("../services/audit.service");
const logger = require("../utils/logger");

// Listen for AUDIT_LOG events emitted by controllers
eventBus.on("AUDIT_LOG", async (payload) => {
  try {
    // payload should match the expected parameters for createAuditLog
    // Note: 'req' object is not fully serializable, so the emitter should pass
    // minimal req data (like ip, userAgent) if necessary, or we just pass 'req' reference.
    // Since this runs in the same Node process, passing 'req' reference works,
    // though passing extracted data is better for memory.
    await createAuditLog(payload);
  } catch (error) {
    logger.error("Failed to asynchronously process audit log:", error);
  }
});

logger.info("Audit listener initialized");
