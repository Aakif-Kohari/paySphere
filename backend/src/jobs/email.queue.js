/**
 * @fileoverview Email BullMQ Queue
 * @description Queue for background email processing (Issue #726). Controllers
 * and cron jobs enqueue here instead of sending inline, so API responses are
 * not blocked on SMTP round-trips. Mirrors the pattern in
 * services/webhook.service.js: `new Queue` is lazy (no Redis touch until
 * `.add()`), using the shared connection from config/redis.js.
 */
const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const emailQueue = new Queue('email-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
  },
});

emailQueue.on('error', () => {
  // Suppress unhandled error crashes when Redis is offline. config/redis.js already logs this.
});

/**
 * Enqueues an email for background delivery.
 * @param {'payslip'|'generic'} type - Which processor in workers/email.worker.js handles this job
 * @param {Object} data - Job payload; shape depends on `type`
 * @returns {Promise<import('bullmq').Job>}
 */
async function enqueueEmail(type, data) {
  return emailQueue.add(type, data);
}

module.exports = { emailQueue, enqueueEmail };
