const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notification.controller');
const auth = require('../middlewares/auth.middleware');
const { requireTenantScope } = require('../utils/tenantScope');

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

// Registered before `/:id/read` so the literal path is matched as a literal.
// The two do not actually collide — one is a single segment and the other is
// two — but the ordering is the convention everywhere else in the codebase and
// it costs nothing to keep a future `/:id` from swallowing it.
router.patch('/read-all', auth, requireTenantScope(), markAllAsRead);

router.get('/', auth, requireTenantScope(), getNotifications);
router.patch('/:id/read', auth, requireTenantScope(), markAsRead);
router.delete('/:id', auth, requireTenantScope(), deleteNotification);

module.exports = router;
