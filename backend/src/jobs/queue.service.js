const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');

const payrollQueue = new Queue('payroll-processing', {
  connection: redisConnection,
});

payrollQueue.on('error', (err) => {
  logger.warn(
    'BullMQ payrollQueue error (likely Redis unreachable):',
    err.message,
  );
});

logger.info('BullMQ payroll-processing queue initialized');

module.exports = {
  payrollQueue,
  connection: redisConnection,
};
