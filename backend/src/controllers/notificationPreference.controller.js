/**
 * Notification preferences (#440, reachable since #952).
 *
 * The model has existed since #440 and there was no endpoint through which a
 * preference could be read or written, so nobody could turn anything off and
 * the email and Slack providers were unreachable from any path in the product.
 *
 * Like the rest of `routes/notification.routes.js`, every handler here operates
 * on rows belonging to the caller and nobody else. There is no permission gate
 * because there is no path to another person's preferences to gate.
 */

const NotificationPreference = require('../models/notificationPreference.model');
const {
  NOTIFICATION_EVENT_TYPES,
  ALL_NOTIFICATION_CHANNELS,
  DEFAULT_CHANNELS,
} = require('../config/notificationEvents');
const { getTenantId } = require('../utils/tenantScope');
const logger = require('../utils/logger');

/** The account whose preferences these are. Same resolution as the bell. */
function ownerOf(req) {
  return req.user?.userId || req.user?._id || req.userId;
}

/**
 * GET /api/notifications/preferences
 *
 * Every event type, with the caller's setting or the default. The client should
 * not have to know which rows exist to render the screen, and it should not be
 * the client's job to know what the event list is either.
 */
exports.getPreferences = async (req, res, next) => {
  try {
    const userId = ownerOf(req);

    const stored = await NotificationPreference.find({ userId }).lean();
    const byEvent = new Map(stored.map((p) => [p.eventType, p]));

    const preferences = NOTIFICATION_EVENT_TYPES.map((eventType) => {
      const row = byEvent.get(eventType);

      return {
        eventType,
        enabled: row ? row.enabled !== false : true,
        channels:
          row && Array.isArray(row.channels) && row.channels.length > 0
            ? row.channels
            : [...DEFAULT_CHANNELS],
        isDefault: !row,
      };
    });

    res.status(200).json({
      channels: ALL_NOTIFICATION_CHANNELS,
      preferences,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notifications/preferences
 *
 * Body: `{ preferences: [{ eventType, enabled, channels }] }`, or a single
 * `{ eventType, enabled, channels }`.
 */
exports.updatePreferences = async (req, res, next) => {
  try {
    const userId = ownerOf(req);
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(403).json({
        message:
          'Your account is not linked to a company yet. Sign in again to continue.',
      });
    }

    const body = req.body || {};
    const incoming = Array.isArray(body.preferences)
      ? body.preferences
      : [body];

    const rejected = [];
    const operations = [];

    for (const entry of incoming) {
      const eventType = String(entry?.eventType || '');

      // Validated against the canonical list rather than left to the schema
      // enum, so the caller is told which entry was wrong instead of getting
      // one opaque ValidationError for the batch.
      if (!NOTIFICATION_EVENT_TYPES.includes(eventType)) {
        rejected.push({ eventType, reason: 'Unknown event type' });
        continue;
      }

      const channels = Array.isArray(entry.channels)
        ? [...new Set(entry.channels.map((c) => String(c).toLowerCase()))]
        : null;

      const unknownChannel = (channels || []).find(
        (c) => !ALL_NOTIFICATION_CHANNELS.includes(c),
      );

      if (unknownChannel) {
        rejected.push({
          eventType,
          reason: `Unknown channel "${unknownChannel}"`,
        });
        continue;
      }

      const update = { tenantId };
      if (entry.enabled !== undefined) update.enabled = Boolean(entry.enabled);
      if (channels) update.channels = channels;

      operations.push({
        updateOne: {
          filter: { userId, eventType },
          update: { $set: update, $setOnInsert: { userId, eventType } },
          upsert: true,
        },
      });
    }

    if (operations.length === 0) {
      return res.status(400).json({
        message: 'No valid preferences to save',
        rejected,
      });
    }

    await NotificationPreference.bulkWrite(operations);

    logger.info('Notification preferences updated', {
      userId: String(userId),
      count: operations.length,
    });

    const stored = await NotificationPreference.find({ userId }).lean();

    res.status(200).json({
      message: `Saved ${operations.length} preference${operations.length === 1 ? '' : 's'}`,
      rejected: rejected.length > 0 ? rejected : undefined,
      preferences: stored.map((p) => ({
        eventType: p.eventType,
        enabled: p.enabled,
        channels: p.channels,
      })),
    });
  } catch (error) {
    if (error?.code === 11000) {
      // Two saves of the same event racing on the unique index. The second is a
      // duplicate, not a server fault.
      return res.status(409).json({
        message: 'Preferences were updated concurrently. Reload and retry.',
      });
    }
    next(error);
  }
};

/**
 * DELETE /api/notifications/preferences/:eventType
 *
 * Back to the default, which is not the same as "disabled".
 */
exports.resetPreference = async (req, res, next) => {
  try {
    const userId = ownerOf(req);
    const { eventType } = req.params;

    if (!NOTIFICATION_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ message: 'Unknown event type' });
    }

    const result = await NotificationPreference.deleteOne({
      userId,
      eventType,
    });

    res.status(200).json({
      message: 'Preference reset to the default',
      eventType,
      removed: result?.deletedCount || 0,
      channels: [...DEFAULT_CHANNELS],
    });
  } catch (error) {
    next(error);
  }
};
