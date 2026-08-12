'use strict';

/**
 * One person's answer to "tell me about this, here" (#440, made real in #952).
 *
 * Written by nothing and read by nothing until #952: the dispatcher that was
 * supposed to consult it could not be required at all, and there was no
 * endpoint through which a preference could be expressed.
 *
 * The event names come from `config/notificationEvents.js` rather than being
 * listed here. #440's enum named seven events — `PAYROLL_COMPLETED`,
 * `SALARY_CHANGED`, `EMPLOYEE_ONBOARDED` and friends — and nothing in the
 * codebase emits any of them, so every row it would have accepted was
 * unmatchable by construction.
 */

const mongoose = require('mongoose');
const {
  NOTIFICATION_EVENT_TYPES,
  ALL_NOTIFICATION_CHANNELS,
  DEFAULT_CHANNELS,
} = require('../config/notificationEvents');

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    eventType: {
      type: String,
      enum: NOTIFICATION_EVENT_TYPES,
      required: true,
    },
    channels: {
      type: [String],
      enum: ALL_NOTIFICATION_CHANNELS,
      default: () => [...DEFAULT_CHANNELS],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// One row per person per event. Keyed on the user rather than the tenant
// because a preference belongs to the person, and this unique key is what makes
// the controller's upsert idempotent.
notificationPreferenceSchema.index(
  { userId: 1, eventType: 1 },
  { unique: true },
);

// The dispatcher reads every preference a set of recipients holds for one
// event, which is this shape exactly.
notificationPreferenceSchema.index({ eventType: 1, userId: 1 });

const NotificationPreference = mongoose.model(
  'NotificationPreference',
  notificationPreferenceSchema,
);

NotificationPreference.KNOWN_EVENT_TYPES = NOTIFICATION_EVENT_TYPES;

module.exports = NotificationPreference;
