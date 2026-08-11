const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const { getTenantId } = require('../utils/tenantScope');

/**
 * The in-app notification centre (#440, #898).
 *
 * These handlers were correct as far as they went, and they went nowhere:
 * nothing in the product ever wrote a `Notification`, so every one of them
 * operated on an empty collection for every account. `services/notification.service.js`
 * and `listeners/notification.listener.js` are the missing half; what is left
 * here is what the handlers themselves got wrong, which only matters now that
 * there are rows for them to get wrong.
 */

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/**
 * The account whose notifications these are.
 *
 * `req.user` is a mongoose document with `_id`; `req.userId` is the string the
 * auth middleware stamps. Both spellings were already being read here, so both
 * are kept.
 *
 * @param {object} req
 * @returns {string|undefined}
 */
function recipientOf(req) {
  return req.user?.userId || req.user?._id || req.userId;
}

/** 403 for a request that is not scoped to a company. */
function refuseUnscoped(res) {
  return res.status(403).json({
    message:
      'Your account is not linked to a company yet. Sign in again to continue.',
  });
}

/**
 * GET /api/notifications — the caller's notifications, newest first.
 *
 * Paginated. The hardcoded `.limit(50)` this replaces had no page after it, so
 * once a busy company passed fifty rows the fifty-first was unreachable — the
 * bell simply stopped showing older items with nothing to say so.
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = recipientOf(req);
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    let page = Number.parseInt(req.query?.page, 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    let limit = Number.parseInt(req.query?.limit, 10);
    if (Number.isNaN(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      limit = DEFAULT_PAGE_SIZE;
    }

    // Scoped on the tenant as well as the user (#898). The collection had no
    // `tenantId` at all, so the only thing separating one company's rows from
    // another's was that user ids happen to be unique — true, but not a scope.
    const filter = { userId, tenantId };
    if (req.query?.unreadOnly === 'true') filter.isRead = false;

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      // Counted against the unfiltered scope on purpose: the badge is "how many
      // unread do I have", not "how many unread are on this page".
      Notification.countDocuments({ userId, tenantId, isRead: false }),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      notifications,
      unreadCount,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const userId = recipientOf(req);
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid ID format' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId, tenantId },
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = recipientOf(req);
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    const result = await Notification.updateMany(
      { userId, tenantId, isRead: false },
      { isRead: true },
    );

    // `modifiedCount` so the client can reconcile rather than assume. The
    // navbar currently flips every row in local state and hopes; with a count
    // it can tell the difference between "nothing was unread" and "the write
    // did not land".
    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result?.modifiedCount ?? 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/notifications/:id
 *
 * There was no way to clear anything, so the list only ever grew. Once rows
 * actually exist that is the difference between a useful bell and a wall.
 */
const deleteNotification = async (req, res, next) => {
  try {
    const userId = recipientOf(req);
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid ID format' });
    }

    const deleted = await Notification.findOneAndDelete({
      _id: id,
      userId,
      tenantId,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
