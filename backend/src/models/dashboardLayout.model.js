const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

/**
 * The widget order a user has dragged their dashboard into.
 *
 * Before #663 this lived in a module-level `Map` inside the router:
 *
 *     const dashboardLayouts = new Map();
 *
 * which is fine for a demo and wrong for everything else. It was wiped on every
 * deploy, it was not shared between instances behind a load balancer — so the
 * layout you saved was the layout you saw only if the balancer happened to send
 * you back to the same process — and nothing ever evicted an entry, so it grew
 * for the life of the process.
 *
 * One document per user. `tenantId` is carried so an account that is removed
 * from a company can have its rows cleaned up with the rest, not because a
 * layout is sensitive.
 */
const dashboardLayoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },

    /**
     * Widget ids, in the order the user wants them rendered.
     *
     * Deliberately not an enum. The dashboard gains and loses widgets between
     * releases, and a layout referring to a widget that no longer exists is not
     * an error — the client drops unknown ids when it rehydrates. Validating
     * against a list here would mean a schema migration every time a widget is
     * added, and would reject a layout saved by a newer client during a rolling
     * deploy.
     *
     * What *is* validated is the shape: short, non-empty, printable ids, and no
     * duplicates. See `isValidWidgetOrder` in the controller.
     */
    order: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

dashboardLayoutSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('DashboardLayout', dashboardLayoutSchema);
