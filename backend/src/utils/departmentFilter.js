const mongoose = require('mongoose');

/**
 * Turning a `?departments=` query string into an employee-id filter (#665).
 *
 * This logic was copied inline into five handlers across two controllers, and
 * every copy carried the same two defects:
 *
 *   1. `require('mongoose').Types.ObjectId(id)` — no `new`. `ObjectId` became a
 *      real ES class in Mongoose 6 and this project runs 9.9:
 *
 *          TypeError: Class constructor ObjectId cannot be invoked without 'new'
 *
 *      The throw landed in the handler's catch and went to `next(error)`, so
 *      any request carrying a department filter was a 500 with no explanation.
 *
 *   2. The employee lookup was scoped by `createdBy: req.userId`. #585 moved
 *      scoping onto `tenantId` and #613 finished the migration through the
 *      controllers, but these copies were missed. Employees created since have
 *      no `createdBy`, so the lookup returned nothing, the `if
 *      (employeeIds.length > 0)` guard was skipped, and the filter was silently
 *      dropped — the response then contained *every* employee's payroll for the
 *      month. A filter that quietly returns more than you asked for is worse
 *      than one that errors.
 *
 * One tested helper rather than five copies that drift.
 */

/**
 * Parse a comma-separated `departments` query parameter.
 *
 * @param {unknown} departmentsParam
 * @returns {string[]} trimmed, non-empty, de-duplicated department names
 */
function parseDepartments(departmentsParam) {
  if (typeof departmentsParam !== 'string' || departmentsParam.trim() === '') {
    return [];
  }

  const seen = new Set();

  for (const part of departmentsParam.split(',')) {
    const name = part.trim();
    if (name !== '') seen.add(name);
  }

  return [...seen];
}

/**
 * Cast a list of ids for use in an `$in`, skipping anything unusable.
 *
 * Mongoose casts string ids against the schema path by itself, so this is
 * belt-and-braces — but a `CastError` from a stray value is a 500, and one bad
 * id should not take a report down.
 *
 * @param {Array<string|object>} ids
 * @returns {import('mongoose').Types.ObjectId[]}
 */
function toObjectIds(ids) {
  const cast = [];

  for (const id of ids || []) {
    if (!mongoose.Types.ObjectId.isValid(id)) continue;
    // `new`. This is the line that threw.
    cast.push(new mongoose.Types.ObjectId(String(id)));
  }

  return cast;
}

/**
 * The employee ids belonging to the named departments, within one tenant.
 *
 * Returns `null` when no departments were requested — meaning "do not filter" —
 * and an empty array when departments were requested and nobody matched, which
 * must narrow the result set to nothing rather than be treated as "no filter".
 * Collapsing those two cases into one falsy check is precisely how the old code
 * turned a filter for a department nobody belongs to into an unfiltered list.
 *
 * @param {import('mongoose').Model} Employee
 * @param {string} tenantId
 * @param {string[]} departments
 * @returns {Promise<import('mongoose').Types.ObjectId[]|null>}
 */
async function resolveDepartmentEmployeeIds(Employee, tenantId, departments) {
  if (!departments || departments.length === 0) return null;

  const employees = await Employee.find({
    tenantId,
    deletedAt: null,
    // `role` as well as `department`: the Reports page's department picker is
    // populated from both fields, so a value the user can select has to be
    // matchable against both.
    $or: [
      { department: { $in: departments } },
      { role: { $in: departments } },
    ],
  })
    .select('_id')
    .lean();

  return toObjectIds(employees.map((employee) => employee._id));
}

/**
 * Apply a department filter to a query object, in place.
 *
 * @param {object} query the query being built
 * @param {import('mongoose').Types.ObjectId[]|null} employeeIds
 * @param {string} [field] the query path holding the employee reference
 * @returns {object} the same query, for chaining
 */
function applyEmployeeFilter(query, employeeIds, field = 'employeeId') {
  // `null` is "no filter requested". `[]` is "filter requested, nobody
  // matched", and `$in: []` correctly matches nothing.
  if (employeeIds === null) return query;

  query[field] = { $in: employeeIds };
  return query;
}

module.exports = {
  parseDepartments,
  toObjectIds,
  resolveDepartmentEmployeeIds,
  applyEmployeeFilter,
};
