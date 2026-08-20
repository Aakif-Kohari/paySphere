const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../utils/logger');

let payrollQueue;
if (process.env.REDIS_URL) {
  payrollQueue = new Queue('payroll-processing', {
    connection: redisConnection,
  });
  payrollQueue.on('error', (err) => {
    logger.warn(
      'BullMQ payrollQueue error (likely Redis unreachable):',
      err.message,
    );
  });
  logger.info('BullMQ payroll-processing queue initialized');
} else {
  payrollQueue = {
    add: async () => {
      logger.warn('Redis is not configured. payrollQueue.add() ignored.');
      return { id: 'mock-job-id' };
    },
    on: () => {},
  };
  logger.warn('BullMQ payroll-processing queue mocked (Redis disabled)');
}

module.exports = {
  payrollQueue,
  connection: redisConnection,
};
