const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');

const payrollQueue = new Queue('payroll-processing', {
  connection: redisConnection,
});

logger.info('BullMQ payroll-processing queue initialized');

module.exports = {
  payrollQueue,
  connection: redisConnection,
};
