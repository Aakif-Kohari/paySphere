/**
 * @fileoverview Webhook BullMQ Worker
 * @description Processes webhook delivery jobs. Generates HMAC-SHA256 signatures, 
 * sends HTTP POST requests, logs the results, and handles exponential backoff.
 * 
 * Issue: #645
 */

const { Worker } = require('bullmq');
const crypto = require('crypto');
const axios = require('axios');
const redisConnection = require('../config/redis');
const WebhookDelivery = require('../models/webhookDelivery.model');
const logger = require('../utils/logger');

/**
 * Generates HMAC-SHA256 signature for the payload
 * @param {Object} payload - The JSON payload to sign
 * @param {string} secret - The endpoint's secret key
 * @returns {string} The hex-encoded signature
 */
function generateSignature(payload, secret) {
  const payloadString = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * Custom backoff strategy for BullMQ
 * Retries at: 1m, 5m, 30m, 2h (as per Issue #645 requirements)
 */
const customBackoffStrategy = (attemptsMade) => {
  const delays = [60000, 300000, 1800000, 7200000]; // 1m, 5m, 30m, 2h
  return delays[attemptsMade] || null; // null tells BullMQ to stop retrying
};

/**
 * The core job processor
 */
async function processWebhookJob(job) {
  const { endpointId, tenantId, url, secret, eventName, payload } = job.data;
  const attempt = job.attemptsMade + 1;

  // 1. Generate HMAC Signature
  const signature = generateSignature(payload, secret);

  // 2. Prepare Delivery Log Entry
  const deliveryLog = {
    endpointId,
    tenantId,
    eventName,
    payload,
    signature,
    attemptCount: attempt,
    isSuccess: false
  };

  try {
    // 3. Send HTTP POST Request
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-PaySphere-Signature': `sha256=${signature}`,
        'X-PaySphere-Event': eventName,
        'User-Agent': 'PaySphere-Webhooks/1.0'
      },
      timeout: 10000, // 10 second timeout
      validateStatus: () => true // Don't throw on 4xx/5xx, handle manually
    });

    // 4. Evaluate Success (2xx status codes are success)
    const isSuccess = response.status >= 200 && response.status < 300;

    deliveryLog.httpStatus = response.status;
    deliveryLog.responseBody = typeof response.data === 'string' 
      ? response.data.slice(0, 1000) 
      : JSON.stringify(response.data).slice(0, 1000);
    deliveryLog.isSuccess = isSuccess;

    if (!isSuccess) {
      throw new Error(`Received HTTP ${response.status}`);
    }

    // 5. Save Success Log
    await WebhookDelivery.create(deliveryLog);
    return { success: true, status: response.status };

  } catch (error) {
    // Handle network errors, timeouts, or non-2xx responses
    deliveryLog.errorMessage = error.message;
    deliveryLog.httpStatus = error.response?.status || null;
    
    // Calculate next retry time if it will be retried
    if (attempt < 5) {
      const delays = [60000, 300000, 1800000, 7200000];
      deliveryLog.nextRetryAt = new Date(Date.now() + (delays[attempt - 1] || 0));
    }

    // Save Failure Log
    await WebhookDelivery.create(deliveryLog);

    logger.warn(`Webhook delivery failed (Attempt ${attempt}/5)`, {
      endpointId,
      url,
      event: eventName,
      error: error.message
    });

    // Throw error to trigger BullMQ retry mechanism
    throw error;
  }
}

// Initialize Worker
const webhookWorker = new Worker('webhook-deliveries', processWebhookJob, {
  connection: redisConnection,
  concurrency: 5, // Process up to 5 webhooks simultaneously
  settings: {
    backoffStrategy: customBackoffStrategy
  }
});

webhookWorker.on('completed', (job) => {
  logger.debug(`Webhook job ${job.id} completed successfully`);
});

webhookWorker.on('failed', (job, err) => {
  if (job.attemptsMade >= 5) {
    logger.error(`Webhook job ${job.id} permanently failed after 5 attempts`, {
      endpointId: job.data.endpointId,
      error: err.message
    });
  }
});

module.exports = webhookWorker;
