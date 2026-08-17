const mongoose = require('mongoose');

/**
 * An in-app notification (#440, given a write path in #898).
 *
 * `tenantId` is new. The collection had `userId` and nothing else, so the only
 * thing keeping one company's rows away from another was that user ids happen
 * to be unique — true, but not a scope, and not something the rest of the
 * product relies on anywhere else (#612). Every read is scoped on it now, so a
 * row written for the wrong company is invisible rather than merely unlikely to
 * be found.
 *
 * `type` and `link` are what turn a line of text into something actionable: the
 * bell can group by type, and clicking a notification can land on the page the
 * thing happened on rather than leaving the reader to go and find it.
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * Free-form on purpose. The vocabulary lives in
     * services/notification.service.js next to the templates that produce it,
     * and an enum here would mean a schema migration every time a feature wants
     * to notify about something new — which is exactly the friction that leaves
     * a notification centre empty.
     */
    type: {
      type: String,
      trim: true,
      default: null,
    },
    /** Where the reader should be taken. A client-side path, never a URL. */
    link: {
      type: String,
      trim: true,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

// The badge query is "unread, for this user, newest first", and it runs on
// every poll of the bell — every thirty seconds, for every signed-in account.
// The single-field indexes above cannot serve it without a sort in memory.
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// The list query, which is the same minus the unread filter.
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
