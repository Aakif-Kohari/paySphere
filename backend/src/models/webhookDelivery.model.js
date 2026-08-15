/**
 * @fileoverview Webhook Delivery Log Schema
 * @description Records every attempt to deliver a webhook payload, including
 * HTTP status, request/response bodies, and retry counts for debugging.
 *
 * Issue: #645
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const webhookDeliverySchema = new mongoose.Schema(
  {
    endpointId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WebhookEndpoint',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    eventName: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    signature: {
      type: String,
      required: true,
    },
    httpStatus: {
      type: Number,
      default: null,
    },
    responseBody: {
      type: String,
      default: '',
    },
    errorMessage: {
      type: String,
      default: '',
    },
    attemptCount: {
      type: Number,
      default: 1,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
    isSuccess: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// TTL Index: Automatically delete delivery logs after 30 days to prevent DB bloat
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

webhookDeliverySchema.plugin(softDeletePlugin);
module.exports = mongoose.model('WebhookDelivery', webhookDeliverySchema);
