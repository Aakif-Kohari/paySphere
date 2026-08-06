/**
 * @fileoverview Webhook Dispatch Service
 * @description Listens to the internal EventBus and enqueues matching webhook 
 * deliveries into the BullMQ queue for asynchronous, retryable processing.
 * 
 * Issue: #645
 */

const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const WebhookEndpoint = require('../models/webhookEndpoint.model');
const logger = require('../utils/logger');
const eventBus = require('./event.service');

/**
 * BullMQ Queue for Webhook Deliveries
 * Configured with exponential backoff for failed deliveries.
 */
const webhookQueue = new Queue('webhook-deliveries', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: { count: 1000 }, // Keep last 1000 successful jobs
        removeOnFail: { count: 5000 },     // Keep last 5000 failed jobs
        attempts: 5,                       // Max 5 attempts
        backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute base delay (1m, 2m, 4m, 8m, 16m - adjusted in worker)
        },
    },
});

/**
 * Maps internal event bus actions to webhook event names
 */
const EVENT_MAPPING = {
    'EMPLOYEE_CREATE': 'EMPLOYEE_CREATE',
    'EMPLOYEE_UPDATE': 'EMPLOYEE_UPDATE',
    'EMPLOYEE_DELETE': 'EMPLOYEE_DELETE',
    'PAYROLL_FINALIZE': 'PAYROLL_FINALIZE',
    'PAYROLL_APPROVE': 'PAYROLL_APPROVE',
    'PAYROLL_REJECT': 'PAYROLL_REJECT',
    'PAYROLL_PAID': 'PAYROLL_PAID' // Maps to PAYROLL_PAID internally if used
};

/**
 * Initializes the webhook service by attaching listeners to the internal event bus.
 * Must be called once during server startup (e.g., in index.js).
 */
function initializeWebhookService() {
    logger.info('Initializing Webhook Dispatch Service...');

    // Listen to all audit log events
    eventBus.on('AUDIT_LOG', async (eventData) => {
        try {
            const internalAction = eventData.action;
            const webhookEvent = EVENT_MAPPING[internalAction];

            // If this internal event doesn't map to a webhook event, ignore it
            if (!webhookEvent) return;

            const tenantId = eventData.tenantId || eventData.req?.tenantId;
            if (!tenantId) {
                logger.warn('Webhook dispatch skipped: Missing tenantId in event', { action: internalAction });
                return;
            }

            // Find all active endpoints subscribed to this event for this tenant
            const endpoints = await WebhookEndpoint.find({
                tenantId,
                isActive: true,
                subscribedEvents: webhookEvent
            }).lean();

            if (endpoints.length === 0) return;

            // Enqueue a job for each subscribed endpoint
            for (const endpoint of endpoints) {
                await webhookQueue.add('deliver', {
                    endpointId: endpoint._id.toString(),
                    tenantId: tenantId.toString(),
                    url: endpoint.url,
                    secret: endpoint.secret,
                    eventName: webhookEvent,
                    payload: {
                        event: webhookEvent,
                        timestamp: new Date().toISOString(),
                        data: eventData.details || {},
                        resourceIds: eventData.resourceIds || []
                    }
                }, {
                    jobId: `${endpoint._id}-${webhookEvent}-${Date.now()}`
                });
            }

            logger.debug(`Enqueued ${endpoints.length} webhook deliveries for event: ${webhookEvent}`);
        } catch (error) {
            // Never let webhook dispatch crash the main event bus
            logger.error('Critical: Webhook dispatch listener failed', { error: error.message });
        }
    });
}

module.exports = {
    webhookQueue,
    initializeWebhookService
};
