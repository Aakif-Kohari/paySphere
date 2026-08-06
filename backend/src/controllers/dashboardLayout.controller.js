const DashboardLayout = require('../models/dashboardLayout.model');
const logger = require('../utils/logger');
const { requireTenant } = require('../utils/tenantScope');

/**
 * Reading and writing a user's dashboard widget order (#663).
 *
 * These two handlers used to be closures inside `routes/dashboard.routes.js`
 * with no `auth` in front of them, writing into a module-level `Map` keyed by
 * `req.user?.id || req.userId || 'anonymous'`. Since nothing populated
 * `req.userId` on an unguarded route, the key was always the literal string
 * `'anonymous'` — every caller on the internet shared one bucket, and any of
 * them could overwrite it.
 *
 * They now sit behind `auth`, key off the authenticated account, and persist.
 */

/** The most widgets a dashboard can hold. A layout longer than this is junk. */
const MAX_WIDGETS = 50;

/** The longest a single widget id may be. */
const MAX_WIDGET_ID_LENGTH = 64;

/**
 * Is this a layout we are willing to store?
 *
 * Rejects anything that is not an array of short, non-empty, unique strings.
 * The old handler checked `Array.isArray(order)` and nothing else, so
 * `{"order": [{"$ne": null}]}` or a hundred-thousand-element array of objects
 * went straight into the store.
 *
 * @param {unknown} order
 * @returns {{ok: true, order: string[]} | {ok: false, message: string}}
 */
function validateWidgetOrder(order) {
  if (!Array.isArray(order)) {
    return { ok: false, message: 'order must be an array of widget ids' };
  }

  if (order.length > MAX_WIDGETS) {
    return {
      ok: false,
      message: `order cannot contain more than ${MAX_WIDGETS} widgets`,
    };
  }

  const cleaned = [];

  for (const id of order) {
    if (typeof id !== 'string') {
      return { ok: false, message: 'every widget id must be a string' };
    }

    const trimmed = id.trim();

    if (trimmed === '') {
      return { ok: false, message: 'a widget id cannot be empty' };
    }

    if (trimmed.length > MAX_WIDGET_ID_LENGTH) {
      return {
        ok: false,
        message: `a widget id cannot exceed ${MAX_WIDGET_ID_LENGTH} characters`,
      };
    }

    if (cleaned.includes(trimmed)) {
      return { ok: false, message: `duplicate widget id: ${trimmed}` };
    }

    cleaned.push(trimmed);
  }

  return { ok: true, order: cleaned };
}

/**
 * GET /api/dashboard/layout
 *
 * Returns `{ order: [] }` for a user who has never dragged anything, which the
 * client reads as "use the default order". That is not an error, so it is a
 * 200 rather than a 404.
 */
exports.getLayout = async (req, res, next) => {
  try {
    // Not because a layout is worth protecting, but because every other read in
    // the application is scoped and an unscoped one here would be the odd
    // exception someone copies later. See utils/tenantScope.js.
    const tenantId = requireTenant(req);

    const layout = await DashboardLayout.findOne({
      userId: req.userId,
      tenantId,
    }).lean();

    return res.status(200).json({ order: layout?.order || [] });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT/POST /api/dashboard/layout
 *
 * Upserts the caller's layout. Idempotent: saving the same order twice is one
 * document either way.
 */
exports.saveLayout = async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);

    // `req.body` is guaranteed to be an object here: `express.json()` runs
    // before this router now, and `requireBody` rejects a POST/PUT without one.
    // Before #663 the router was mounted above both, so `req.body` was
    // `undefined` and destructuring it threw a TypeError on every call.
    const validated = validateWidgetOrder(req.body?.order);

    if (!validated.ok) {
      return res.status(400).json({ message: validated.message });
    }

    const layout = await DashboardLayout.findOneAndUpdate(
      { userId: req.userId },
      { $set: { order: validated.order, tenantId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    logger.debug('Dashboard layout saved', {
      userId: req.userId,
      widgets: layout.order.length,
    });

    return res.status(200).json({ success: true, order: layout.order });
  } catch (error) {
    next(error);
  }
};

exports.MAX_WIDGETS = MAX_WIDGETS;
exports.MAX_WIDGET_ID_LENGTH = MAX_WIDGET_ID_LENGTH;
exports.validateWidgetOrder = validateWidgetOrder;
