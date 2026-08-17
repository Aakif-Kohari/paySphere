const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getVapidPublicKey,
  subscribe,
  unsubscribe,
} = require('../controllers/notification.controller');
const {
  getPreferences,
  updatePreferences,
  resetPreference,
} = require('../controllers/notificationPreference.controller');
const auth = require('../middlewares/auth.middleware');
const { requireTenantScope } = require('../utils/tenantScope');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

/**
 * The notification centre (#440, #898).
 *
 * No permission gate, deliberately, and it is the one router in the product
 * where that is the right answer: every handler reads and writes rows belonging
 * to the caller and nobody else. A permission would be describing access to
 * someone else's data, and there is no path here that reaches any.
 * `requireTenantScope` is the guard that matters — it is what keeps an unscoped
 * request from querying on `userId` alone.
 */

// ---------------------------------------------------------------------------
// Push Subscription Endpoints (Issue #1027)
// ---------------------------------------------------------------------------

// Public endpoint (no auth required to fetch public key, but rate limited)
router.get('/vapid-public-key', writeRateLimiter, getVapidPublicKey);

// Protected endpoints
router.post('/subscribe', auth, writeRateLimiter, subscribe);
router.post('/unsubscribe', auth, writeRateLimiter, unsubscribe);

// ---------------------------------------------------------------------------
// In-App Notification Endpoints (#440, #898)
// ---------------------------------------------------------------------------

// Registered before `/:id/read` so the literal path is matched as a literal.
// The two do not actually collide — one is a single segment and the other is
// two — but the ordering is the convention everywhere else in the codebase and
// it costs nothing to keep a future `/:id` from swallowing it.
router.patch('/read-all', auth, requireTenantScope(), markAllAsRead);

// Preferences (#440, reachable since #952). On this router rather than a new
// mount point, for the reason `expense.routes.js` keeps categories on its own:
// the whole feature stays behind one prefix. Declared above `/:id` for the same
// ordering reason as `/read-all`.
router.get('/preferences', auth, requireTenantScope(), getPreferences);
router.put('/preferences', auth, requireTenantScope(), updatePreferences);
router.delete(
  '/preferences/:eventType',
  auth,
  requireTenantScope(),
  resetPreference,
);

router.get('/', auth, requireTenantScope(), getNotifications);
router.patch('/:id/read', auth, requireTenantScope(), markAsRead);
router.delete('/:id', auth, requireTenantScope(), deleteNotification);

module.exports = router;
