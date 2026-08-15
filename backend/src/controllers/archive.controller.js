const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const { getTenantId } = require('../utils/tenantScope');

/**
 * The archive browser for soft-deleted employees (#759, repaired in #897).
 *
 * Three things were wrong with the sixteen lines this replaces, and the first
 * one made the other two invisible.
 *
 * The query selected on `isDeleted: true`, and nothing in the product has ever
 * written that field. `deleteEmployee` set `deletedAt` and left `isDeleted` at
 * its default of `false`, so this endpoint returned `[]` for every account in
 * every company since the day it shipped. The fix for that is in
 * `employee.controller.js`; without it, everything below is a correctly-scoped
 * view of an empty set.
 *
 * The filter was `createdBy: req.userId` — the account id of the caller, not
 * the company. PaySphere is multi-admin: everything Admin A archived was
 * invisible to Admin B, and the page renders the same `EmptyState` either way,
 * so neither of them could tell "nothing has been archived" from "someone else
 * archived it". For a compliance surface whose entire job is showing what was
 * deleted, quietly showing a subset is worse than an error.
 *
 * And there was no `limit`, on a query that returns whole employee documents —
 * salary, email, department — for a tenant that may have churned thousands of
 * them.
 */

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/** 403 for a request that is not scoped to a company. */
function refuseUnscoped(res) {
  return res.status(403).json({
    message:
      'Your account is not linked to a company yet. Sign in again to continue.',
  });
}

/**
 * GET /api/archive/employees — the company's soft-deleted employees.
 */
exports.getArchivedEmployees = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    let page = Number.parseInt(req.query?.page, 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    let limit = Number.parseInt(req.query?.limit, 10);
    if (Number.isNaN(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      limit = DEFAULT_PAGE_SIZE;
    }

    // `isDeleted: true` also disables the plugin's own hook, which would
    // otherwise append `isDeleted: { $ne: true }` and contradict the filter —
    // but `setOptions` is passed anyway so the query does not depend on that
    // implementation detail staying true.
    const query = { tenantId, isDeleted: true };

    const [total, employees] = await Promise.all([
      Employee.countDocuments(query).setOptions({ includeDeleted: true }),
      Employee.find(query)
        .setOptions({ includeDeleted: true })
        .sort({ deletedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      data: employees,
      // `total` so the UI can show a count and page, rather than inferring the
      // end of the list from a short page.
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
 * GET /api/archive/employees/:id — one archived record.
 *
 * The list returns whole documents today, which is its own problem; this exists
 * so the UI can confirm what it is about to restore without holding a stale
 * copy from a list that may have been paged away.
 */
exports.getArchivedEmployee = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return refuseUnscoped(res);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const employee = await Employee.findOne({
      _id: id,
      tenantId,
      isDeleted: true,
    }).setOptions({ includeDeleted: true });

    if (!employee) {
      // Indistinguishable from "does not exist", so a caller cannot probe for
      // another company's employee ids.
      return res.status(404).json({ message: 'Archived employee not found' });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};
