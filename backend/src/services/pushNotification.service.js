/**
 * @fileoverview Push Notification Service
 * @description Handles VAPID key configuration, payload encryption, 
 * and dispatching push messages to the Web Push API.
 * 
 * Issue: #1027
 */
const webpush = require('web-push');
const PushSubscription = require('../models/pushSubscription.model');
const logger = require('../utils/logger');

// VAPID keys should be stored in environment variables in production.
// These are mock keys for development/demonstration. Generate real ones via `web-push generate-vapid-keys`.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BGxY4N5_...';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'XYz123...';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@paysphere.com';

// Configure web-push with VAPID details
if (VAPID_PUBLIC_KEY !== 'BGxY4N5_...' && VAPID_PRIVATE_KEY !== 'XYz123...') {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
    logger.warn('Push Notifications: Using mock VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env for production.');
}

/**
 * Sends a push notification to a specific user's active devices.
 * 
 * @param {string} userId - The recipient user's ID
 * @param {string} tenantId - The tenant ID for scoping
 * @param {Object} payload - The notification payload (title, body, icon, data)
 */
async function sendPushToUser(userId, tenantId, payload) {
    const subscriptions = await PushSubscription.find({
        userId,
        tenantId,
        isActive: true
    }).lean();

    if (subscriptions.length === 0) {
        logger.debug(`No active push subscriptions found for user ${userId}`);
        return;
    }

    const notificationPayload = JSON.stringify(payload);
    const invalidSubscriptions = [];

    // Send to all active devices concurrently
    const sendPromises = subscriptions.map(async (sub) => {
        try {
            await webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: sub.keys
                },
                notificationPayload
            );
        } catch (error) {
            logger.error(`Failed to send push to ${sub.endpoint}:`, error.message);

            // If the subscription is no longer valid (410 Gone), mark it for deletion
            if (error.statusCode === 410 || error.statusCode === 404) {
                invalidSubscriptions.push(sub._id);
            }
        }
    });

    await Promise.allSettled(sendPromises);

    // Clean up invalid/expired subscriptions
    if (invalidSubscriptions.length > 0) {
        await PushSubscription.deleteMany({ _id: { $in: invalidSubscriptions } });
        logger.info(`Cleaned up ${invalidSubscriptions.length} invalid push subscriptions for user ${userId}`);
    }
}

/**
 * Helper to send a Payroll Generated notification.
 * @param {string} userId 
 * @param {string} tenantId 
 * @param {string} month 
 * @param {string} year 
 */
async function notifyPayslipGenerated(userId, tenantId, month, year) {
    const payload = {
        title: 'New Payslip Available 📄',
        body: `Your payslip for ${month}/${year} has been generated and is ready to view.`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: {
            url: '/dashboard?tab=payslips', // Deep link to payslips
            type: 'PAYSLIP_GENERATED'
        },
        actions: [
            { action: 'view', title: 'View Payslip' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    await sendPushToUser(userId, tenantId, payload);
}

module.exports = {
    sendPushToUser,
    notifyPayslipGenerated,
    VAPID_PUBLIC_KEY // Expose public key so frontend can request it
};
