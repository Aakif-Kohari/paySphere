const AuditLog = require("../models/auditLog.model");

exports.getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const logs = await AuditLog.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalLogs = await AuditLog.countDocuments({ userId: req.userId });

    res.status(200).json({
      logs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: page,
      totalLogs
    });
  } catch (error) {
    next(error);
  }
};

// EXPORT AUDIT LOGS TO CSV
exports.exportAuditLogsCSV = async (req, res, next) => {
  try {
    const { startDate, endDate, days } = req.query;
    const query = { userId: req.userId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    } else if (days) {
      const daysNum = parseInt(days, 10);
      if (!isNaN(daysNum) && daysNum > 0) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - daysNum);
        query.createdAt = { $gte: pastDate };
      }
    }

    const logs = await AuditLog.find(query).sort({ createdAt: -1 });

    const header = [
      "Timestamp",
      "Action",
      "Resource Type",
      "Resource IDs",
      "Result",
      "Details",
      "IP Address",
      "User Agent",
    ];

    const escapeCsvField = (value) => {
      if (value === undefined || value === null) return "";
      let str = typeof value === "object" ? JSON.stringify(value) : String(value);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map((log) => [
      escapeCsvField(log.createdAt ? new Date(log.createdAt).toISOString() : ""),
      escapeCsvField(log.action || ""),
      escapeCsvField(log.resourceType || ""),
      escapeCsvField(Array.isArray(log.resourceIds) ? log.resourceIds.join("; ") : log.resourceIds || ""),
      escapeCsvField(log.result || "success"),
      escapeCsvField(log.details || {}),
      escapeCsvField(log.ipAddress || log.ip || ""),
      escapeCsvField(log.userAgent || ""),
    ]);

    const csvContent = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=audit_logs_${new Date().toISOString().split("T")[0]}.csv`
    );

    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
