/**
 * @fileoverview Push Subscription Schema
 * @description Stores Web Push subscription endpoints and encryption keys 
 * for sending push notifications to employee devices.
 * 
 * Issue: #1027
 */
const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

        // The unique endpoint provided by the push service (e.g., FCM, Mozilla)
        endpoint: { type: String, required: true, unique: true },

        // Cryptographic keys required for encrypting the push payload
        keys: {
            auth: { type: String, required: true },
            p256dh: { type: String, required: true }
        },

        // User agent to identify the device/browser
        userAgent: { type: String, default: '' },

        // Whether the user has explicitly enabled notifications in settings
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

// Index for fast lookup of all active subscriptions for a specific user
pushSubscriptionSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
