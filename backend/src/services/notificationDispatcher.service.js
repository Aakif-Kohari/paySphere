'use strict';

/**
 * Where a notification goes, and whether it goes at all (#440, repaired in #952).
 *
 * Three separate reasons this had never executed a line:
 *
 *   - `require('./logger')` — the logger is at `utils/logger.js`, and there is
 *     no `services/logger.js`, so requiring this module threw MODULE_NOT_FOUND.
 *   - nothing required it. `grep -rn "notificationDispatcher" src` matched only
 *     the file itself, so the broken require was never reached to be noticed.
 *   - `cacheService.set(key, value, ttl)` does not exist. The cache service
 *     exports `setEx(key, ttl, value)` — a different name *and* a different
 *     argument order — so the de-duplication guard could never have written its
 *     key and would have suppressed nothing.
 *
 * The template table that used to live here is gone. It rendered seven event
 * types that nothing in the product emits, while `services/notification.service.js`
 * already owns the wording for the events that are actually notifiable. One
 * source of copy is the point.
 *
 * Everything here is best-effort by construction. It runs detached from a
 * request that has already committed, so a provider being down is a log line,
 * never an exception reaching the caller.
 */

const NotificationPreference = require('../models/notificationPreference.model');
const registry = require('../notifications/registry');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');
const {
  NOTIFICATION_CHANNELS,
  ALL_NOTIFICATION_CHANNELS,
  DEFAULT_CHANNELS,
} = require('../config/notificationEvents');

/** How long the same notification to the same person is suppressed. */
const DEDUP_TTL_SECONDS = 5 * 60;

/**
 * The de-duplication key.
 *
 * Includes what the event was *about*, which the original did not: keyed on
 * user and event type alone, two different expense claims approved for the same
 * person within five minutes produced one notification and the second claim was
 * never mentioned to anybody. Suppressing a genuine repeat is useful;
 * suppressing a different fact is data loss.
 *
 * @param {string} userId
 * @param {string} eventType
 * @param {string} [subjectId] what the event concerned
 * @returns {string}
 */
function dedupKey(userId, eventType, subjectId) {
  return `notif:dedup:${userId}:${eventType}:${subjectId || 'none'}`;
}

/**
 * Has this exact notification already gone out in the last few minutes?
 *
 * A cache failure answers "no". Sending a duplicate is a worse outcome than a
 * missed suppression, but not sending at all because the cache is down is worse
 * than both.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function isDuplicate(key) {
  try {
    return Boolean(await cacheService.get(key));
  } catch (error) {
    logger.debug('Notification dedup check failed; sending anyway', {
      error: error.message,
    });
    return false;
  }
}

/**
 * Record that it went out.
 *
 * @param {string} key
 * @returns {Promise<void>}
 */
async function markSent(key) {
  try {
    // setEx(key, ttl, value) — the argument order the cache service actually
    // has. The call this replaces was `set(key, value, ttl)`, which is neither
    // the right name nor the right order.
    await cacheService.setEx(key, DEDUP_TTL_SECONDS, true);
  } catch (error) {
    logger.debug('Notification dedup key could not be written', {
      error: error.message,
    });
  }
}

/**
 * Normalise a stored preference into a channel list.
 *
 * @param {object|null} preference
 * @returns {string[]} empty when the user has switched this event off
 */
function channelsFrom(preference) {
  if (!preference) return [...DEFAULT_CHANNELS];
  if (preference.enabled === false) return [];

  const channels = Array.isArray(preference.channels)
    ? preference.channels.filter((c) => ALL_NOTIFICATION_CHANNELS.includes(c))
    : [];

  // A row that enables an event but names no valid channel is a preference to
  // be told, with no instruction about where — the default is the honest
  // reading, and silence would be a preference the user never expressed.
  return channels.length > 0 ? channels : [...DEFAULT_CHANNELS];
}

/**
 * The channels each of these recipients wants this event on.
 *
 * One query for the whole set rather than one per person: the callers resolve a
 * company's admins and then ask about all of them at once.
 *
 * Never throws — a preference lookup that fails falls back to the default for
 * everybody, because losing the notification entirely is the worse failure.
 *
 * @param {Array<string|object>} userIds
 * @param {string} eventType
 * @returns {Promise<Map<string, string[]>>} userId -> channels
 */
async function resolveChannels(userIds, eventType) {
  const ids = (Array.isArray(userIds) ? userIds : []).map(String);
  const resolved = new Map(ids.map((id) => [id, [...DEFAULT_CHANNELS]]));

  if (ids.length === 0) return resolved;

  try {
    const preferences = await NotificationPreference.find({
      userId: { $in: ids },
      eventType,
    }).lean();

    for (const preference of preferences) {
      resolved.set(String(preference.userId), channelsFrom(preference));
    }
  } catch (error) {
    logger.error('Notification preferences could not be read; using defaults', {
      eventType,
      error: error.message,
    });
  }

  return resolved;
}

/**
 * Hand one message to one channel.
 *
 * @param {string} channel
 * @param {{to: string, subject: string, body: string, metadata?: object}} message
 * @returns {Promise<boolean>} whether the provider accepted it
 */
async function deliver(channel, { to, subject, body, metadata = {} }) {
  try {
    await registry
      .get(channel)
      .send({ to: String(to), subject, body, metadata });
    return true;
  } catch (error) {
    // One channel failing must not stop the others. An unknown channel lands
    // here too, because `registry.get` throws for a name with no provider.
    logger.error('Notification delivery failed', {
      channel,
      to: String(to),
      error: error.message,
    });
    return false;
  }
}

/**
 * Send one notification to one person, honouring their preference.
 *
 * @param {object} notification
 * @param {string} notification.userId
 * @param {string} notification.tenantId
 * @param {string} notification.eventType
 * @param {string} notification.subject
 * @param {string} notification.body
 * @param {string} [notification.subjectId] what the event was about, for dedup
 * @param {object} [notification.metadata]
 * @returns {Promise<{sent: string[], suppressed: string|null}>}
 */
async function dispatch({
  userId,
  tenantId,
  eventType,
  subject,
  body,
  subjectId,
  metadata = {},
}) {
  if (!userId || !eventType || !subject || !body) {
    logger.warn('Notification dropped: incomplete', { eventType });
    return { sent: [], suppressed: 'incomplete' };
  }

  const key = dedupKey(String(userId), eventType, subjectId);

  if (await isDuplicate(key)) {
    return { sent: [], suppressed: 'duplicate' };
  }

  const channels = channelsFrom(await readPreference(userId, eventType));

  if (channels.length === 0) {
    return { sent: [], suppressed: 'preference' };
  }

  const results = await Promise.all(
    channels.map(async (channel) => ({
      channel,
      ok: await deliver(channel, {
        to: userId,
        subject,
        body,
        metadata: { ...metadata, tenantId, eventType },
      }),
    })),
  );

  const sent = results.filter((r) => r.ok).map((r) => r.channel);

  // Only record it as sent if something actually went out, so a total delivery
  // failure is retried rather than suppressed for five minutes.
  if (sent.length > 0) await markSent(key);

  return { sent, suppressed: null };
}

/**
 * One user's preference row, or null.
 *
 * @param {string} userId
 * @param {string} eventType
 * @returns {Promise<object|null>}
 */
async function readPreference(userId, eventType) {
  try {
    return await NotificationPreference.findOne({ userId, eventType }).lean();
  } catch (error) {
    logger.error('Notification preference lookup failed', {
      eventType,
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  dispatch,
  deliver,
  resolveChannels,
  channelsFrom,
  readPreference,
  NOTIFICATION_CHANNELS,
  DEDUP_TTL_SECONDS,
  _internals: { dedupKey, isDuplicate, markSent },
};
