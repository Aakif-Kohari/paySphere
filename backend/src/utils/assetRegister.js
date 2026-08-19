/**
 * Fixed Asset Register: category rollup, impairment testing, custody ageing.
 *
 * Pure functions — no database access — for the same reason
 * `depreciationCalculator.js` is pure: these produce the statement an auditor
 * reads, and the arithmetic has to be testable against its boundaries in
 * isolation (#1156).
 *
 * `depreciationCalculator.js` handles one asset at a time — a monthly charge,
 * a multi-year forecast, a disposal gain. Nothing looks at the register as a
 * whole, so the questions an auditor actually asks have no answer:
 *
 *   - gross block, additions, disposals, accumulated depreciation and net
 *     block per category for a period;
 *   - which assets are carried above what they are worth;
 *   - which assets an employee is still holding past their return date.
 *
 * The last of those was doubly unanswerable: `assignAsset` writes an
 * `expectedReturnDate` that the assignment schema never declared, so Mongoose
 * stripped it on every save.
 */

'use strict';

/**
 * How long an asset has been on the books.
 *
 * Bands rather than a raw age because the register is read to answer "how much
 * of our block is nearly written off", and that is a question about groups.
 */
const ASSET_AGE_BANDS = [
  { band: '0-1 years', maxYears: 1 },
  { band: '1-3 years', maxYears: 3 },
  { band: '3-5 years', maxYears: 5 },
  { band: '5+ years', maxYears: Infinity },
];

/**
 * How late a return is.
 *
 * The first band exists because "one day late" and "four months late" are not
 * the same operational problem, and a flat overdue list cannot tell them apart.
 */
const OVERDUE_AGEING_BANDS = [
  { band: '1-7 days', maxDays: 7 },
  { band: '8-30 days', maxDays: 30 },
  { band: '31-90 days', maxDays: 90 },
  { band: '90+ days', maxDays: Infinity },
];

/** Statuses that take an asset out of the live register. */
const DISPOSED_STATUSES = ['Retired', 'Lost'];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * A number, or 0 for anything that is not one.
 *
 * @param {*} value
 * @returns {number}
 */
function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * A date, or null for anything unparseable.
 *
 * @param {*} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * An asset's category as a string key.
 *
 * `categoryId` arrives as an ObjectId, a populated category document, or a
 * plain string depending on whether the caller populated it. Grouping on the
 * raw value puts one category in three rows of the register.
 *
 * @param {object} asset
 * @returns {string}
 */
function categoryKeyOf(asset) {
  const category = asset?.categoryId;
  if (!category) return 'uncategorised';
  if (typeof category === 'string') return category;
  if (category._id) return String(category._id);
  return String(category);
}

/**
 * The period a depreciation run belongs to, as `YYYY-MM`.
 *
 * A string rather than a date because it is used as an equality key: the point
 * is to answer "has this asset already been depreciated for this month?", and
 * comparing dates makes that a range question with an edge case at every month
 * boundary.
 *
 * @param {Date|string} [date]
 * @returns {string}
 */
function resolveDepreciationPeriod(date = new Date()) {
  const parsed = toDate(date) || new Date();
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Whether an asset still owes a depreciation charge for a period.
 *
 * `runMonthlyDepreciation` subtracts a month of depreciation every time it is
 * called, with nothing recording which month it just ran. Two calls in one
 * month — a retried cron, an admin pressing the button twice — depreciate
 * twice, and the register understates net block for the rest of the asset's
 * life with no way to tell it happened (#1156).
 *
 * @param {object} asset
 * @param {string} period
 * @returns {boolean}
 */
function shouldDepreciateForPeriod(asset, period) {
  if (!asset) return false;
  if (DISPOSED_STATUSES.includes(asset.status)) return false;
  return asset.lastDepreciationPeriod !== period;
}

/**
 * Impairment testing, and the reversal ceiling that makes it safe.
 *
 * An asset carried above what it is worth overstates the register. Writing it
 * down is straightforward; writing it back up is where the accounting rule
 * lives. A reversal may restore what impairment took away and no more —
 * carrying value must never exceed what it would have been had the asset never
 * been impaired at all. Without that ceiling, an asset can be written down and
 * back up repeatedly until its carrying value exceeds what it cost.
 *
 * @param {object} asset
 * @param {number} recoverableAmount what the asset is actually worth now
 * @returns {object}
 */
function computeImpairment(asset, recoverableAmount) {
  const carryingValue = round2(num(asset?.currentBookValue));
  const accumulatedImpairment = round2(num(asset?.accumulatedImpairment));
  const recoverable = Number(recoverableAmount);

  if (!Number.isFinite(recoverable) || recoverable < 0) {
    return {
      ok: false,
      errors: ['Recoverable amount must be zero or a positive number'],
    };
  }

  if (DISPOSED_STATUSES.includes(asset?.status)) {
    return {
      ok: false,
      errors: [`An asset that is "${asset.status}" cannot be impaired`],
    };
  }

  const rounded = round2(recoverable);

  // Carried below what it is worth: write it down.
  if (rounded < carryingValue) {
    const impairmentLoss = round2(carryingValue - rounded);

    return {
      ok: true,
      errors: [],
      carryingValue,
      recoverableAmount: rounded,
      impairmentLoss,
      impairmentReversal: 0,
      revisedCarryingValue: rounded,
      accumulatedImpairment: round2(accumulatedImpairment + impairmentLoss),
      isImpaired: true,
    };
  }

  // Carried above what it is worth: a reversal, but only up to what impairment
  // previously took away.
  if (rounded > carryingValue) {
    const reversal = round2(
      Math.min(rounded - carryingValue, accumulatedImpairment),
    );

    return {
      ok: true,
      errors: [],
      carryingValue,
      recoverableAmount: rounded,
      impairmentLoss: 0,
      impairmentReversal: reversal,
      revisedCarryingValue: round2(carryingValue + reversal),
      accumulatedImpairment: round2(accumulatedImpairment - reversal),
      isImpaired: accumulatedImpairment - reversal > 0,
      // Said out loud rather than silently clipped, so a finance user who
      // expected the full write-back knows the ceiling bound it.
      cappedByCeiling: rounded - carryingValue > accumulatedImpairment,
    };
  }

  return {
    ok: true,
    errors: [],
    carryingValue,
    recoverableAmount: rounded,
    impairmentLoss: 0,
    impairmentReversal: 0,
    revisedCarryingValue: carryingValue,
    accumulatedImpairment,
    isImpaired: accumulatedImpairment > 0,
  };
}

/**
 * The Fixed Asset Register, rolled up by category.
 *
 * The statement an auditor asks for. The invariant that makes it a statement
 * rather than a list is that, on every row and on the total:
 *
 *     netBlock === grossBlock - accumulatedDepreciation - accumulatedImpairment
 *
 * Accumulated depreciation is derived — `purchasePrice - currentBookValue -
 * accumulatedImpairment` — rather than stored, because there is no field
 * holding it and a second source for the same figure is a second thing that
 * can disagree.
 *
 * Additions and disposals are movements *within* the period; gross and net
 * block are positions *at the end of it*. Mixing the two is the usual way a
 * register fails to tie out.
 *
 * @param {object[]} assets
 * @param {object[]} [categories]
 * @param {object} [period]
 * @param {Date|string} [period.startDate]
 * @param {Date|string} [period.endDate]
 * @returns {object}
 */
function buildFixedAssetRegister(assets, categories = [], period = {}) {
  const list = Array.isArray(assets) ? assets : [];

  const startDate = toDate(period.startDate);
  const endDate = toDate(period.endDate);

  const categoryNames = new Map(
    (Array.isArray(categories) ? categories : []).map((category) => [
      String(category._id ?? category.id ?? ''),
      {
        name: category.name || 'Uncategorised',
        depreciationMethod: category.depreciationMethod || 'SLM',
        usefulLifeYears: num(category.usefulLifeYears),
      },
    ]),
  );

  /**
   * Whether a date falls inside the reporting period. An open-ended period —
   * neither bound supplied — includes everything, which is what "the register
   * as it stands today" means.
   */
  const withinPeriod = (date) => {
    if (!date) return false;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  };

  const rows = new Map();

  for (const asset of list) {
    const key = categoryKeyOf(asset);

    if (!rows.has(key)) {
      // A populated `categoryId` carries the name; an unpopulated one does not,
      // so fall back to the categories list and then to a placeholder rather
      // than emitting a row labelled `undefined`.
      const populated =
        asset.categoryId && typeof asset.categoryId === 'object'
          ? asset.categoryId
          : null;
      const known = categoryNames.get(key);

      rows.set(key, {
        categoryId: key === 'uncategorised' ? null : key,
        categoryName: populated?.name || known?.name || 'Uncategorised',
        depreciationMethod:
          populated?.depreciationMethod || known?.depreciationMethod || 'SLM',
        assetCount: 0,
        grossBlock: 0,
        additions: 0,
        disposals: 0,
        accumulatedDepreciation: 0,
        accumulatedImpairment: 0,
        netBlock: 0,
        disposedCount: 0,
      });
    }

    const row = rows.get(key);

    const purchasePrice = num(asset.purchasePrice);
    const bookValue = num(asset.currentBookValue);
    const impairment = num(asset.accumulatedImpairment);
    const isDisposed = DISPOSED_STATUSES.includes(asset.status);

    if (withinPeriod(toDate(asset.purchaseDate))) {
      row.additions = round2(row.additions + purchasePrice);
    }

    if (isDisposed) {
      row.disposedCount += 1;

      if (withinPeriod(toDate(asset.disposedAt))) {
        row.disposals = round2(row.disposals + purchasePrice);
      }

      // A disposed asset is off the live register: it contributes to the
      // disposals movement and to nothing else. Leaving its gross block in
      // would have the register report assets the company no longer owns.
      continue;
    }

    row.assetCount += 1;
    row.grossBlock = round2(row.grossBlock + purchasePrice);
    row.netBlock = round2(row.netBlock + bookValue);
    row.accumulatedImpairment = round2(row.accumulatedImpairment + impairment);
    row.accumulatedDepreciation = round2(
      row.accumulatedDepreciation +
        Math.max(purchasePrice - bookValue - impairment, 0),
    );
  }

  const categoryRows = [...rows.values()].sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName),
  );

  const sum = (key) =>
    round2(categoryRows.reduce((total, row) => total + row[key], 0));

  const totals = {
    assetCount: categoryRows.reduce((total, row) => total + row.assetCount, 0),
    disposedCount: categoryRows.reduce(
      (total, row) => total + row.disposedCount,
      0,
    ),
    grossBlock: sum('grossBlock'),
    additions: sum('additions'),
    disposals: sum('disposals'),
    accumulatedDepreciation: sum('accumulatedDepreciation'),
    accumulatedImpairment: sum('accumulatedImpairment'),
    netBlock: sum('netBlock'),
  };

  // The tie-out, computed rather than asserted, so a caller can surface a
  // register that does not balance instead of publishing one that does not.
  const derivedNetBlock = round2(
    totals.grossBlock -
      totals.accumulatedDepreciation -
      totals.accumulatedImpairment,
  );

  return {
    period: {
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
    },
    categories: categoryRows,
    totals,
    derivedNetBlock,
    // Compared to the paise. A register that does not tie out is not a
    // rounding question, it is a bug in whatever wrote the book values.
    isBalanced: Math.abs(derivedNetBlock - totals.netBlock) < 0.01,
  };
}

/**
 * Assets an employee is holding past their expected return date.
 *
 * Reachable only now that `expectedReturnDate` is declared on the assignment
 * schema — `assignAsset` has written it since the module shipped and Mongoose
 * has silently dropped it on every save, so there has never been a return date
 * to be late against (#1156).
 *
 * An assignment with no expected return date is open-ended and cannot be
 * overdue; it is counted separately rather than treated as either.
 *
 * @param {object[]} assignments
 * @param {Date|string} [asOf]
 * @returns {object}
 */
function detectOverdueReturns(assignments, asOf = new Date()) {
  const list = Array.isArray(assignments) ? assignments : [];
  const now = toDate(asOf) || new Date();

  const overdue = [];
  let openEndedCount = 0;
  let activeCount = 0;

  for (const assignment of list) {
    if (!assignment?.isActive) continue;

    activeCount += 1;

    const expected = toDate(assignment.expectedReturnDate);

    if (!expected) {
      openEndedCount += 1;
      continue;
    }

    const daysOverdue = Math.floor((now - expected) / MS_PER_DAY);

    if (daysOverdue <= 0) continue;

    overdue.push({
      assignmentId: assignment._id ? String(assignment._id) : null,
      assetId: assignment.assetId ? String(assignment.assetId) : null,
      employeeId: assignment.employeeId ? String(assignment.employeeId) : null,
      checkoutDate: toDate(assignment.checkoutDate),
      expectedReturnDate: expected,
      daysOverdue,
      ageingBand: bandForDaysOverdue(daysOverdue),
    });
  }

  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const byBand = OVERDUE_AGEING_BANDS.map((band) => ({
    band: band.band,
    count: overdue.filter((entry) => entry.ageingBand === band.band).length,
  }));

  return {
    asOf: now.toISOString(),
    activeCount,
    openEndedCount,
    overdueCount: overdue.length,
    byBand,
    overdue,
  };
}

/**
 * @param {number} days
 * @returns {string}
 */
function bandForDaysOverdue(days) {
  const band = OVERDUE_AGEING_BANDS.find((entry) => days <= entry.maxDays);
  return (band || OVERDUE_AGEING_BANDS[OVERDUE_AGEING_BANDS.length - 1]).band;
}

/**
 * @param {number} years
 * @returns {string}
 */
function bandForAgeYears(years) {
  const band = ASSET_AGE_BANDS.find((entry) => years <= entry.maxYears);
  return (band || ASSET_AGE_BANDS[ASSET_AGE_BANDS.length - 1]).band;
}

/**
 * The register's composition by asset age.
 *
 * `netBlockPercent` is the figure worth reading: a block concentrated in the
 * 5+ band is one that is nearly written off and due for replacement, and that
 * is a budgeting fact rather than an accounting one.
 *
 * @param {object[]} assets
 * @param {Date|string} [asOf]
 * @returns {object}
 */
function summarizeAssetAgeing(assets, asOf = new Date()) {
  const list = Array.isArray(assets) ? assets : [];
  const now = toDate(asOf) || new Date();

  const buckets = new Map(
    ASSET_AGE_BANDS.map((band) => [
      band.band,
      { band: band.band, count: 0, grossBlock: 0, netBlock: 0 },
    ]),
  );

  let totalNetBlock = 0;

  for (const asset of list) {
    if (DISPOSED_STATUSES.includes(asset?.status)) continue;

    const purchaseDate = toDate(asset.purchaseDate);
    // No purchase date is not an age of zero — that would report a broken row
    // as a brand-new asset. It falls to the oldest band, where it is visible.
    const ageYears = purchaseDate
      ? (now - purchaseDate) / (MS_PER_DAY * 365.25)
      : Infinity;

    const bucket = buckets.get(bandForAgeYears(ageYears));

    bucket.count += 1;
    bucket.grossBlock = round2(bucket.grossBlock + num(asset.purchasePrice));
    bucket.netBlock = round2(bucket.netBlock + num(asset.currentBookValue));
    totalNetBlock = round2(totalNetBlock + num(asset.currentBookValue));
  }

  const bands = [...buckets.values()].map((bucket) => ({
    ...bucket,
    netBlockPercent: totalNetBlock
      ? round2((bucket.netBlock / totalNetBlock) * 100)
      : 0,
  }));

  return {
    asOf: now.toISOString(),
    assetCount: bands.reduce((total, band) => total + band.count, 0),
    totalNetBlock,
    bands,
  };
}

module.exports = {
  ASSET_AGE_BANDS,
  OVERDUE_AGEING_BANDS,
  DISPOSED_STATUSES,
  round2,
  categoryKeyOf,
  resolveDepreciationPeriod,
  shouldDepreciateForPeriod,
  computeImpairment,
  buildFixedAssetRegister,
  detectOverdueReturns,
  bandForDaysOverdue,
  bandForAgeYears,
  summarizeAssetAgeing,
};
