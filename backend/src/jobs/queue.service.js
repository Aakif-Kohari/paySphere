const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");
const logger = require("../utils/logger");

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const payrollQueue = new Queue("payroll-processing", { connection });

logger.info("BullMQ payroll-processing queue initialized");

module.exports = {
  payrollQueue,
  connection,
};
