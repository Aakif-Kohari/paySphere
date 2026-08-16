/**
 * @fileoverview ESOP vesting schedule, perquisite valuation and pool accounting.
 * @description Pure functions — no Mongoose, no I/O, no clock. Everything that
 * depends on "now" takes an `asOf` argument, so the same grant produces the same
 * answer in a test as it does in production, and a schedule can be projected
 * forwards or replayed backwards.
 *
 * Issue: #1073
 *
 * Two things in here are arithmetic rather than policy and are worth stating up
 * front, because getting either wrong is the kind of bug that surfaces years
 * later in somebody's tax return:
 *
 *   - **Tranches must sum to the grant.** 1,000 options over 48 monthly
 *     tranches is 20.83 options a month. Rounding each tranche independently
 *     loses 40 options; rounding up loses the company 8. `buildVestingSchedule`
 *     therefore floors every tranche and puts the whole remainder in the last
 *     one, so the schedule is exact by construction and `sum(tranches)` is an
 *     assertion rather than a hope.
 *
 *   - **The perquisite floors at zero.** Under s.17(2)(vi) the taxable
 *     perquisite on exercise is `(FMV − exercise price) × options`. When the
 *     option is underwater — FMV below the strike, which happens — that
 *     expression is negative, and a negative perquisite fed into payroll is a
 *     *refund of tax the employee never paid*. It is clamped, and the underwater
 *     case is reported rather than silently zeroed.
 */

'use strict';

/** Vesting cadences, in months per tranche. */
const VESTING_FREQUENCIES = Object.freeze({
  monthly: 1,
  quarterly: 3,
  'semi-annual': 6,
  annual: 12,
});

/** Grant lifecycle states. */
const GRANT_STATUS = Object.freeze({
  ACTIVE: 'Active',
  FORFEITED: 'Forfeited',
  FULLY_EXERCISED: 'FullyExercised',
  LAPSED: 'Lapsed',
});

/**
 * Round to two decimals.
 *
 * Money only. Option *counts* are integers everywhere in this file — a fifth of
 * a share is not a thing anyone can exercise — and are floored rather than
 * rounded so the running total can never exceed the grant.
 *
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Add whole months to a date, clamping the day rather than rolling over.
 *
 * `new Date(2026, 0, 31)` plus one month is 31 February, which JavaScript
 * silently turns into 2 or 3 March depending on the year. A grant dated the 31st
 * would then vest its tranches on the 2nd or 3rd of alternate months, and a
 * schedule that drifts is a schedule nobody trusts. Clamping to the last valid
 * day of the target month keeps a 31 January grant vesting on 28 February and
 * back on 31 March.
 *
 * @param {Date|string} date
 * @param {number} months
 * @returns {Date}
 */
function addMonths(date, months) {
  const base = new Date(date);
  if (Number.isNaN(base.getTime())) return new Date(NaN);

  const day = base.getUTCDate();
  const target = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth() + Number(months || 0),
      1,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
    ),
  );

  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/**
 * Whole days between two dates, `to − from`. Negative when `to` precedes `from`.
 *
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {number}
 */
function daysBetween(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Normalise the vesting terms of a grant, rejecting combinations that cannot
 * produce a schedule.
 *
 * Validation lives here rather than in the schema because the *combination* is
 * what is invalid, not any single field: a 24-month cliff on an 18-month grant
 * is two individually reasonable numbers that together describe a grant which
 * never vests anything.
 *
 * @param {object} grant
 * @returns {{valid: boolean, errors: string[], terms?: object}}
 */
function normaliseTerms(grant) {
  const errors = [];

  const optionsGranted = Math.floor(Number(grant?.optionsGranted));
  const cliffMonths = Math.floor(Number(grant?.cliffMonths ?? 12));
  const durationMonths = Math.floor(Number(grant?.vestingDurationMonths ?? 48));
  const frequency = String(grant?.vestingFrequency || 'monthly').toLowerCase();
  const start = new Date(grant?.vestingStartDate || grant?.grantDate);

  if (!Number.isFinite(optionsGranted) || optionsGranted <= 0) {
    errors.push('optionsGranted must be a positive whole number');
  }
  if (!Number.isFinite(cliffMonths) || cliffMonths < 0) {
    errors.push('cliffMonths cannot be negative');
  }
  if (!Number.isFinite(durationMonths) || durationMonths <= 0) {
    errors.push('vestingDurationMonths must be greater than zero');
  }
  if (!VESTING_FREQUENCIES[frequency]) {
    errors.push(
      `vestingFrequency must be one of: ${Object.keys(VESTING_FREQUENCIES).join(', ')}`,
    );
  }
  if (Number.isNaN(start.getTime())) {
    errors.push('vestingStartDate (or grantDate) is not a valid date');
  }
  if (cliffMonths > durationMonths) {
    errors.push(
      `cliffMonths (${cliffMonths}) exceeds vestingDurationMonths (${durationMonths}); nothing would ever vest`,
    );
  }

  const periodMonths = VESTING_FREQUENCIES[frequency];

  if (periodMonths && cliffMonths % periodMonths !== 0) {
    // A 12-month cliff on a quarterly schedule is fine (12 = 4 quarters). A
    // 10-month cliff on the same schedule is not: it lands mid-period, and
    // there is no defensible answer for how much of that period vests.
    errors.push(
      `cliffMonths (${cliffMonths}) is not a whole number of ${frequency} periods`,
    );
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    terms: {
      optionsGranted,
      cliffMonths,
      durationMonths,
      frequency,
      periodMonths,
      start,
    },
  };
}

/**
 * Expand a grant into dated vesting tranches.
 *
 * Shape of the result, for a 1,000-option grant with a 12-month cliff vesting
 * monthly over 48 months:
 *
 *   - one cliff tranche dated `start + 12 months` for 12 periods' worth,
 *   - 36 monthly tranches after it,
 *   - the last of which absorbs the rounding remainder.
 *
 * With `cliffMonths: 0` there is no cliff tranche and the first period vests at
 * `start + periodMonths` — deliberately not at `start` itself, because nothing
 * has been earned on day one.
 *
 * @param {object} grant
 * @returns {{valid: boolean, errors: string[], tranches: Array<object>, totalOptions: number}}
 */
function buildVestingSchedule(grant) {
  const normalised = normaliseTerms(grant);

  if (!normalised.valid) {
    return {
      valid: false,
      errors: normalised.errors,
      tranches: [],
      totalOptions: 0,
    };
  }

  const {
    optionsGranted,
    cliffMonths,
    durationMonths,
    frequency,
    periodMonths,
    start,
  } = normalised.terms;

  // Periods are counted over the whole duration and then split at the cliff, so
  // a cliff never changes the total. `ceil` covers a duration that is not a
  // whole number of periods (a 50-month quarterly grant), where the final,
  // short period still vests in full at the end date.
  const totalPeriods = Math.ceil(durationMonths / periodMonths);
  const cliffPeriods = Math.floor(cliffMonths / periodMonths);

  const perPeriod = Math.floor(optionsGranted / totalPeriods);
  const tranches = [];
  let allocated = 0;

  if (cliffPeriods > 0) {
    const cliffOptions = perPeriod * cliffPeriods;
    allocated += cliffOptions;
    tranches.push({
      index: 0,
      isCliff: true,
      vestDate: addMonths(start, cliffMonths),
      options: cliffOptions,
      cumulativeOptions: allocated,
      periodsCovered: cliffPeriods,
    });
  }

  for (let period = cliffPeriods + 1; period <= totalPeriods; period += 1) {
    const isFinal = period === totalPeriods;

    // The final tranche takes everything still unallocated. That is the whole
    // rounding-drift defence: 1,000 / 48 floors to 20, 48 × 20 = 960, and the
    // last tranche is 60 rather than 20.
    const options = isFinal ? optionsGranted - allocated : perPeriod;
    allocated += options;

    // Month offset is capped at the duration so the short final period of a
    // non-divisible schedule lands on the end date rather than past it.
    const monthOffset = Math.min(period * periodMonths, durationMonths);

    tranches.push({
      index: tranches.length,
      isCliff: false,
      vestDate: addMonths(start, monthOffset),
      options,
      cumulativeOptions: allocated,
      periodsCovered: 1,
    });
  }

  return {
    valid: true,
    errors: [],
    frequency,
    tranches,
    totalOptions: allocated,
  };
}

/**
 * Vested / unvested position on a given date.
 *
 * `exercisable` is vested minus already-exercised, which is the number a UI
 * should show next to an "Exercise" button — vested alone tells an employee they
 * can exercise options they exercised last year.
 *
 * @param {object} grant
 * @param {Date|string} asOf
 * @returns {object}
 */
function vestedAsOf(grant, asOf) {
  const schedule = buildVestingSchedule(grant);

  if (!schedule.valid) {
    return {
      valid: false,
      errors: schedule.errors,
      vested: 0,
      unvested: 0,
      exercisable: 0,
      exercised: 0,
      percentVested: 0,
      nextVestDate: null,
      nextVestOptions: 0,
    };
  }

  const when = new Date(asOf);
  const exercised = Math.max(
    0,
    Math.floor(Number(grant?.optionsExercised) || 0),
  );

  let vested = 0;
  let nextVestDate = null;
  let nextVestOptions = 0;

  for (const tranche of schedule.tranches) {
    if (tranche.vestDate.getTime() <= when.getTime()) {
      vested += tranche.options;
    } else if (nextVestDate === null) {
      nextVestDate = tranche.vestDate;
      nextVestOptions = tranche.options;
    }
  }

  const total = schedule.totalOptions;

  return {
    valid: true,
    errors: [],
    asOf: when,
    totalOptions: total,
    vested,
    unvested: total - vested,
    exercised,
    // Clamped: a data-entry error that records more exercises than have vested
    // should not produce a negative exercisable count that a caller then treats
    // as a limit.
    exercisable: Math.max(0, vested - exercised),
    percentVested: total > 0 ? round2((vested / total) * 100) : 0,
    nextVestDate,
    nextVestOptions,
  };
}

/**
 * Perquisite value and TDS on an exercise — s.17(2)(vi).
 *
 * The taxable perquisite is the spread between fair market value on the date of
 * exercise and the price actually paid, taxed as salary income in the year of
 * exercise and withheld through payroll by the employer. The FMV then becomes
 * the cost basis for the employee's capital gain when the shares are eventually
 * sold; carrying it here is what stops the same gain being taxed twice.
 *
 * @param {object} input
 * @param {number} input.optionsExercised
 * @param {number} input.fmvPerShare       fair market value on the exercise date
 * @param {number} input.exercisePrice     strike price per share
 * @param {number} [input.taxRatePercent]  marginal rate applied for withholding
 * @returns {object}
 */
function computePerquisite({
  optionsExercised,
  fmvPerShare,
  exercisePrice,
  taxRatePercent = 30,
}) {
  const options = Math.floor(Number(optionsExercised) || 0);
  const fmv = Number(fmvPerShare) || 0;
  const strike = Number(exercisePrice) || 0;
  const rate = Number(taxRatePercent) || 0;

  const spreadPerShare = fmv - strike;
  const underwater = spreadPerShare < 0;

  // Clamped at zero. A negative perquisite would flow into payroll as negative
  // taxable income — i.e. as a refund of tax that was never withheld — which is
  // both wrong and the sort of wrong that reconciles to nothing.
  const perquisiteValue = round2(Math.max(0, spreadPerShare) * options);
  const tdsWithheld = round2(perquisiteValue * (rate / 100));

  return {
    optionsExercised: options,
    fmvPerShare: round2(fmv),
    exercisePrice: round2(strike),
    spreadPerShare: round2(spreadPerShare),
    underwater,
    perquisiteValue,
    taxRatePercent: rate,
    tdsWithheld,
    // What the employee actually pays the company to take up the shares.
    exerciseCost: round2(strike * options),
    // Cost basis carried into the capital-gains computation on eventual sale.
    capitalGainsCostBasis: round2(fmv * options),
    netTaxableAddition: perquisiteValue,
  };
}

/**
 * What happens to a grant when the holder leaves.
 *
 * Unvested options lapse on the exit date. Vested-but-unexercised options are
 * retained, but only for the scheme's post-termination exercise window — after
 * which they lapse too, and that deadline is the single most valuable thing to
 * be able to tell a leaver. It is returned rather than merely computed
 * internally so `settlement.model.js` can surface it in the full & final
 * statement.
 *
 * @param {object} grant
 * @param {Date|string} exitDate
 * @param {number} [windowDays] post-termination exercise window
 * @returns {object}
 */
function computeForfeitureOnExit(grant, exitDate, windowDays = 90) {
  const position = vestedAsOf(grant, exitDate);

  if (!position.valid) {
    return { valid: false, errors: position.errors };
  }

  const exit = new Date(exitDate);
  const days = Math.max(0, Math.floor(Number(windowDays) || 0));

  const forfeited = position.unvested;
  const retained = position.exercisable;
  const windowClosesOn = new Date(exit.getTime() + days * 86400000);

  return {
    valid: true,
    errors: [],
    exitDate: exit,
    optionsForfeited: forfeited,
    optionsRetained: retained,
    optionsAlreadyExercised: position.exercised,
    exerciseWindowDays: days,
    exerciseWindowClosesOn: windowClosesOn,
    // A window of zero means the vested options lapse with the unvested ones.
    // Reported explicitly because "retained: 400, window: 0 days" is otherwise
    // an easy thing to read as good news.
    lapsesImmediately: days === 0 && retained > 0,
    resultingStatus:
      retained > 0 ? GRANT_STATUS.ACTIVE : GRANT_STATUS.FORFEITED,
  };
}

/**
 * Pool accounting for a scheme.
 *
 * The pool is the number of options the board authorised. Granting past it is
 * not a rounding problem, it is a governance failure — the company has promised
 * more equity than it has been authorised to issue — so `overCommitted` is
 * reported as its own flag rather than left to be inferred from a negative
 * `available`.
 *
 * Forfeited options return to the pool, which is why this cannot be a running
 * counter on the scheme document.
 *
 * @param {object} scheme
 * @param {Array<object>} grants
 * @returns {object}
 */
function summarisePool(scheme, grants = []) {
  const authorised = Math.max(
    0,
    Math.floor(Number(scheme?.authorisedPool) || 0),
  );

  let granted = 0;
  let exercised = 0;
  let forfeited = 0;

  for (const grant of grants) {
    const total = Math.max(0, Math.floor(Number(grant?.optionsGranted) || 0));
    const done = Math.max(0, Math.floor(Number(grant?.optionsExercised) || 0));
    const lost = Math.max(0, Math.floor(Number(grant?.optionsForfeited) || 0));

    granted += total;
    exercised += done;
    forfeited += lost;
  }

  // Forfeited options go back into the pool, so they are netted off the
  // committed figure rather than added to it.
  const committed = granted - forfeited;
  const available = authorised - committed;

  return {
    authorisedPool: authorised,
    optionsGranted: granted,
    optionsExercised: exercised,
    optionsForfeited: forfeited,
    optionsCommitted: committed,
    optionsAvailable: Math.max(0, available),
    overCommitted: available < 0,
    overCommitmentBy: available < 0 ? Math.abs(available) : 0,
    utilisationPercent:
      authorised > 0 ? round2((committed / authorised) * 100) : 0,
  };
}

/**
 * Can this scheme absorb a grant of `requestedOptions`?
 *
 * Split out from `summarisePool` because the controller needs a yes/no with a
 * reason it can put in a 409 body, and building that string at the call site is
 * how two endpoints end up disagreeing about the rule.
 *
 * @param {object} scheme
 * @param {Array<object>} grants
 * @param {number} requestedOptions
 * @returns {{allowed: boolean, reason: string|null, pool: object}}
 */
function canGrant(scheme, grants, requestedOptions) {
  const pool = summarisePool(scheme, grants);
  const requested = Math.floor(Number(requestedOptions) || 0);

  if (requested <= 0) {
    return {
      allowed: false,
      reason: 'Requested options must be a positive whole number',
      pool,
    };
  }

  if (requested > pool.optionsAvailable) {
    return {
      allowed: false,
      reason:
        `Scheme pool has ${pool.optionsAvailable} options available; ` +
        `${requested} requested`,
      pool,
    };
  }

  return { allowed: true, reason: null, pool };
}

module.exports = {
  VESTING_FREQUENCIES,
  GRANT_STATUS,
  round2,
  addMonths,
  daysBetween,
  normaliseTerms,
  buildVestingSchedule,
  vestedAsOf,
  computePerquisite,
  computeForfeitureOnExit,
  summarisePool,
  canGrant,
};
