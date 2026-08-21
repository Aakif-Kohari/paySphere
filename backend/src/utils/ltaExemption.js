/**
 * Leave Travel Allowance exemption — section 10(5) read with Rule 2B (#1345).
 *
 * This is a separate module from `taxProof` deliberately, and the reason is not
 * tidiness. Every other exemption in the product is annual: a rent receipt or
 * an 80C proof belongs to a financial year, is worth what it is worth, and the
 * arithmetic is `min(claimed, ceiling)`. LTA is none of those things.
 *
 *   - The entitlement is a *block* of four calendar years fixed by statute —
 *     2022-2025, then 2026-2029. Not the financial year. Not the employee's
 *     joining anniversary.
 *   - Two journeys per block, not two per year.
 *   - One unavailed journey carries into the *first year of the next block*
 *     only, and is the rule most often got wrong in practice.
 *   - Only the travel fare is exempt, capped by mode, and hotels, food and
 *     local transport are exempt at no amount whatsoever.
 *   - The family definition is statutory and includes a two-child restriction
 *     with a 1 October 1998 cut-off and a multiple-birth carve-out.
 *
 * None of that fits `{ category, amount, financialYear }`, which is why it is
 * modelled here instead of squeezed into the proof model.
 *
 * Pure functions, no database access, in the same shape as `settlement.js` —
 * an exemption is a number an employee will argue with, and every step that
 * produced it should be reachable from a test and explainable in a sentence.
 */

/**
 * Blocks run in fixed four-year periods anchored on 1986, which is where the
 * scheme starts. Derived rather than hard-coded: a table of blocks would be
 * correct until 2030 and then quietly wrong.
 */
const BLOCK_ANCHOR_YEAR = 1986;
const BLOCK_LENGTH_YEARS = 4;

/** Journeys exempt in one block. */
const JOURNEYS_PER_BLOCK = 2;

/**
 * The two-child restriction applies to children born on or after this date.
 * Children born before it are not counted against the limit at all.
 */
const TWO_CHILD_RULE_FROM = new Date('1998-10-01T00:00:00.000Z');

/** Children born on or after the cut-off who may be claimed for. */
const MAX_RESTRICTED_CHILDREN = 2;

/** Modes of travel, each with its own statutory ceiling. */
const TRAVEL_MODE = {
  AIR: 'air',
  RAIL: 'rail',
  /** A place connected by a recognised public transport service, but not by rail. */
  PUBLIC_TRANSPORT: 'public_transport',
  /** A place connected by neither — the ceiling falls back to AC first class rail. */
  OTHER: 'other',
};

/**
 * Which fare each mode is capped at.
 *
 * The names are the ones Rule 2B uses, and they are what the caller has to
 * supply. This module does not know what an economy fare from Delhi to Kochi
 * costs and should not pretend to — a fare table would be stale within a
 * quarter and wrong for every route it did not have.
 */
const FARE_BASIS = {
  [TRAVEL_MODE.AIR]: 'economyAirFare',
  [TRAVEL_MODE.RAIL]: 'acFirstClassRailFare',
  [TRAVEL_MODE.PUBLIC_TRANSPORT]: 'deluxeBusFare',
  [TRAVEL_MODE.OTHER]: 'acFirstClassRailFare',
};

const FARE_BASIS_LABEL = {
  economyAirFare:
    'economy class fare of the national carrier by the shortest route',
  acFirstClassRailFare:
    'air-conditioned first class rail fare by the shortest route',
  deluxeBusFare:
    'first class or deluxe class fare of the recognised transport service',
};

/** Relationships that can be claimed for. */
const RELATIONSHIP = {
  SELF: 'self',
  SPOUSE: 'spouse',
  CHILD: 'child',
  PARENT: 'parent',
  SIBLING: 'sibling',
};

/**
 * Relationships that are only eligible while wholly or mainly dependent on the
 * employee. Spouse and children are not on this list; parents and siblings are.
 */
const DEPENDENCY_REQUIRED = new Set([
  RELATIONSHIP.PARENT,
  RELATIONSHIP.SIBLING,
]);

/** Named refusals, so a rejected claim can say which rule refused it. */
const REFUSAL = {
  BLOCK_EXHAUSTED: 'BLOCK_EXHAUSTED',
  INTERNATIONAL: 'INTERNATIONAL',
  NO_ELIGIBLE_TRAVELLER: 'NO_ELIGIBLE_TRAVELLER',
  NO_LTA_COMPONENT: 'NO_LTA_COMPONENT',
  INVALID_JOURNEY: 'INVALID_JOURNEY',
};

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

/**
 * @param {*} value
 * @returns {Date|null}
 */
function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The statutory block a calendar year falls in.
 *
 * @param {number} year
 * @returns {{startYear: number, endYear: number, label: string}}
 */
function blockForYear(year) {
  const numeric = Number(year);

  if (!Number.isInteger(numeric) || numeric < BLOCK_ANCHOR_YEAR) {
    throw new RangeError(
      `Year must be an integer of ${BLOCK_ANCHOR_YEAR} or later, received ${year}`,
    );
  }

  const index = Math.floor((numeric - BLOCK_ANCHOR_YEAR) / BLOCK_LENGTH_YEARS);
  const startYear = BLOCK_ANCHOR_YEAR + index * BLOCK_LENGTH_YEARS;
  const endYear = startYear + BLOCK_LENGTH_YEARS - 1;

  return { startYear, endYear, label: `${startYear}-${endYear}` };
}

/**
 * The block a journey falls in.
 *
 * Keyed on the *calendar* year of travel. Using the financial year here is the
 * single most common implementation error and it misclassifies every January
 * to March journey — which, given when people take leave, is a lot of them.
 *
 * @param {Date|string} date
 * @returns {{startYear: number, endYear: number, label: string}}
 */
function blockForDate(date) {
  const parsed = parseDate(date);
  if (!parsed) throw new RangeError('A valid journey date is required');
  return blockForYear(parsed.getUTCFullYear());
}

/**
 * The block immediately before a given one.
 *
 * @param {{startYear: number}} block
 * @returns {{startYear: number, endYear: number, label: string}}
 */
function previousBlock(block) {
  return blockForYear(block.startYear - BLOCK_LENGTH_YEARS);
}

/**
 * Is this the first calendar year of its block?
 *
 * The whole of the carry-forward rule turns on this: an unavailed journey may
 * be taken in the first year of the succeeding block and nowhere else. Not
 * "within the next block", which is what a naive reading gives and what makes
 * a claim in year three of the block look allowable when it is not.
 *
 * @param {number} year
 * @returns {boolean}
 */
function isFirstYearOfBlock(year) {
  return blockForYear(year).startYear === Number(year);
}

/**
 * Whether a child counts against the two-child restriction.
 *
 * Two carve-outs, both real and both easy to miss:
 *
 *   - children born *before* 1 October 1998 are outside the restriction
 *     entirely and are never counted;
 *   - multiple births after the first child count as one. Twins born as the
 *     second and third children are one child for this purpose, and refusing
 *     the third is a wrong answer that looks like a correct one.
 *
 * @param {object} child
 * @returns {boolean}
 */
function childCountsAgainstLimit(child) {
  const dob = parseDate(child.dateOfBirth);

  if (!dob) return true;
  if (dob < TWO_CHILD_RULE_FROM) return false;

  // A multiple birth is identified by the caller grouping the children under a
  // shared `birthGroupId`; the group is counted once, by its first member, and
  // the rest are marked as not counting. `assessTravellers` does that grouping
  // because it is the only place that sees all the children at once.
  return true;
}

/**
 * Which travellers on a journey are eligible, and why the others are not.
 *
 * @param {Array<object>} travellers
 * @returns {{eligible: Array<object>, ineligible: Array<object>}}
 */
function assessTravellers(travellers) {
  const list = Array.isArray(travellers) ? travellers : [];

  const eligible = [];
  const ineligible = [];

  // Children first, because the two-child restriction needs to see them
  // together — it is a limit on the set, not a test on each one.
  const children = list.filter((t) => t.relationship === RELATIONSHIP.CHILD);
  const restrictedChildIds = new Set();
  const seenBirthGroups = new Set();
  let restrictedCount = 0;

  const orderedChildren = [...children].sort((a, b) => {
    const left = parseDate(a.dateOfBirth);
    const right = parseDate(b.dateOfBirth);
    if (!left || !right) return 0;
    return left - right;
  });

  for (const child of orderedChildren) {
    if (!childCountsAgainstLimit(child)) continue;

    // Everyone in a multiple birth shares the group's single slot. The slot is
    // consumed by whichever of them is seen first.
    const groupId = child.birthGroupId || null;
    const alreadyCounted = groupId !== null && seenBirthGroups.has(groupId);

    if (!alreadyCounted) {
      restrictedCount += 1;
      if (groupId !== null) seenBirthGroups.add(groupId);
    }

    if (restrictedCount > MAX_RESTRICTED_CHILDREN) {
      restrictedChildIds.add(child);
    }
  }

  for (const traveller of list) {
    const relationship = traveller.relationship;

    if (!Object.values(RELATIONSHIP).includes(relationship)) {
      ineligible.push({
        ...traveller,
        reason: `"${relationship}" is not a relationship section 10(5) covers — the family is the employee, spouse, children, and dependent parents and siblings`,
      });
      continue;
    }

    if (DEPENDENCY_REQUIRED.has(relationship) && !traveller.dependent) {
      ineligible.push({
        ...traveller,
        reason: `A ${relationship} is only eligible while wholly or mainly dependent on the employee`,
      });
      continue;
    }

    if (
      relationship === RELATIONSHIP.CHILD &&
      restrictedChildIds.has(traveller)
    ) {
      ineligible.push({
        ...traveller,
        reason:
          'Beyond the two-child restriction for children born on or after 1 October 1998',
      });
      continue;
    }

    eligible.push(traveller);
  }

  return { eligible, ineligible };
}

/**
 * The exempt fare for one journey.
 *
 * `min(what was actually spent, the statutory ceiling for the mode)`, and the
 * ceiling is the caller's to supply — see `FARE_BASIS` above for why this
 * module does not carry a fare table.
 *
 * When no ceiling is supplied the claimed fare is allowed and the result is
 * flagged `capUnverified`. That is deliberate: silently allowing the full
 * amount without saying so is how an unverified business class ticket becomes
 * an exemption nobody questioned, and refusing outright would block every claim
 * for a route the fare table does not cover.
 *
 * @param {object} journey
 * @returns {object}
 */
function computeJourneyFare(journey) {
  const mode = journey.mode || TRAVEL_MODE.OTHER;
  const basis = FARE_BASIS[mode] || FARE_BASIS[TRAVEL_MODE.OTHER];

  const claimed = Number(journey.claimedFare);

  if (!Number.isFinite(claimed) || claimed < 0) {
    return {
      mode,
      basis,
      claimedFare: 0,
      ceiling: null,
      exemptFare: 0,
      capApplied: false,
      capUnverified: false,
      note: 'No usable fare was claimed for this journey',
    };
  }

  const ceilingRaw = journey.fareCeilings
    ? journey.fareCeilings[basis]
    : undefined;
  const ceiling = Number(ceilingRaw);

  if (!Number.isFinite(ceiling) || ceiling < 0) {
    return {
      mode,
      basis,
      claimedFare: round2(claimed),
      ceiling: null,
      exemptFare: round2(claimed),
      capApplied: false,
      capUnverified: true,
      note: `No ${FARE_BASIS_LABEL[basis]} was supplied, so the claimed fare has not been capped`,
    };
  }

  const exemptFare = Math.min(claimed, ceiling);

  return {
    mode,
    basis,
    claimedFare: round2(claimed),
    ceiling: round2(ceiling),
    exemptFare: round2(exemptFare),
    capApplied: exemptFare < claimed,
    capUnverified: false,
    note:
      exemptFare < claimed
        ? `Capped at the ${FARE_BASIS_LABEL[basis]}`
        : `Within the ${FARE_BASIS_LABEL[basis]}`,
  };
}

/**
 * How many journeys have already been availed in a block, and whether an
 * unavailed journey carries into it.
 *
 * `history` is the employee's previously *approved* journeys. Pending ones are
 * deliberately not counted — a claim sitting in the verification queue has not
 * consumed anything yet, and counting it would make an employee's second
 * journey depend on how fast HR is working.
 *
 * @param {Array<object>} history
 * @param {{startYear: number, endYear: number}} block
 * @returns {object}
 */
function blockPosition(history, block) {
  const approved = (Array.isArray(history) ? history : []).filter(
    (entry) => entry.status === 'approved',
  );

  const inBlock = approved.filter((entry) => {
    const date = parseDate(entry.journeyDate);
    if (!date) return false;
    const year = date.getUTCFullYear();
    return year >= block.startYear && year <= block.endYear;
  });

  const prior = previousBlock(block);
  const inPrevious = approved.filter((entry) => {
    const date = parseDate(entry.journeyDate);
    if (!date) return false;
    const year = date.getUTCFullYear();
    return year >= prior.startYear && year <= prior.endYear;
  });

  const unavailedInPrevious = Math.max(
    0,
    JOURNEYS_PER_BLOCK - inPrevious.length,
  );

  // At most one journey carries forward, however many were left unused.
  const carriedForward = Math.min(1, unavailedInPrevious);

  return {
    block,
    previousBlock: prior,
    availedInBlock: inBlock.length,
    availedInPreviousBlock: inPrevious.length,
    carryForwardAvailable: carriedForward,
    baseEntitlement: JOURNEYS_PER_BLOCK,
  };
}

/**
 * Whether a journey in a given year may use the carried-forward entitlement.
 *
 * @param {number} year
 * @param {object} position from `blockPosition`
 * @returns {boolean}
 */
function carryForwardUsable(year, position) {
  return position.carryForwardAvailable > 0 && isFirstYearOfBlock(year);
}

/**
 * Assess a claim end to end.
 *
 * The order matters and is the order the statute applies in: establish the
 * block, check the entitlement is not exhausted, work out who may be claimed
 * for, cap the fare by mode, and only then cap the whole thing at the LTA
 * actually paid in the salary structure — which is a different number from what
 * the journey cost and is the last word on the exemption whatever the fare was.
 *
 * @param {object} claim
 * @param {object} [context]
 * @param {Array<object>} [context.history] previously approved journeys
 * @param {number} [context.ltaComponentPaid] LTA paid in the salary structure
 * @returns {object}
 */
function assessClaim(claim, context = {}) {
  const journeyDate = parseDate(claim.journeyDate);
  const refusals = [];
  const notes = [];

  if (!journeyDate) {
    return {
      allowed: false,
      exemptAmount: 0,
      refusals: [
        {
          code: REFUSAL.INVALID_JOURNEY,
          message: 'A valid journey date is required',
        },
      ],
      notes,
    };
  }

  const year = journeyDate.getUTCFullYear();
  const block = blockForYear(year);
  const position = blockPosition(context.history, block);

  // --- Entitlement --------------------------------------------------------

  const usesCarryForward =
    position.availedInBlock >= JOURNEYS_PER_BLOCK &&
    carryForwardUsable(year, position);

  const entitlementRemaining =
    JOURNEYS_PER_BLOCK - position.availedInBlock + (usesCarryForward ? 1 : 0);

  if (entitlementRemaining <= 0) {
    refusals.push({
      code: REFUSAL.BLOCK_EXHAUSTED,
      message:
        position.carryForwardAvailable > 0
          ? `Both journeys for the ${block.label} block are used. The unavailed journey from ${position.previousBlock.label} could only have been taken in ${block.startYear}.`
          : `Both journeys for the ${block.label} block are already used`,
    });
  } else if (usesCarryForward) {
    notes.push(
      `Uses the journey carried forward from the ${position.previousBlock.label} block, which is available in ${block.startYear} only`,
    );
  }

  // --- Where -------------------------------------------------------------

  // The exemption is for travel within India, full stop. A journey with a
  // foreign leg is not partially exempt — the whole journey falls outside
  // section 10(5).
  if (claim.international === true) {
    refusals.push({
      code: REFUSAL.INTERNATIONAL,
      message:
        'Section 10(5) covers travel within India only — a journey with a foreign leg is not exempt at any amount',
    });
  }

  // --- Who ---------------------------------------------------------------

  const { eligible, ineligible } = assessTravellers(claim.travellers);

  if (eligible.length === 0) {
    refusals.push({
      code: REFUSAL.NO_ELIGIBLE_TRAVELLER,
      message: 'No traveller on this journey is eligible under section 10(5)',
    });
  }

  // --- How much ----------------------------------------------------------

  const fare = computeJourneyFare(claim);

  // The fare is claimed for the party as a whole, so an ineligible traveller
  // reduces it proportionately rather than voiding the journey. Pro-rating by
  // head is the conventional treatment and the only one that survives a party
  // of four where one member is a third child.
  const totalTravellers = eligible.length + ineligible.length;
  const eligibleShare =
    totalTravellers === 0 ? 0 : eligible.length / totalTravellers;

  const fareForEligible = round2(fare.exemptFare * eligibleShare);

  if (ineligible.length > 0) {
    notes.push(
      `Fare apportioned across ${eligible.length} of ${totalTravellers} travellers — ${ineligible.length} ineligible`,
    );
  }

  if (fare.capApplied) notes.push(fare.note);
  if (fare.capUnverified) notes.push(fare.note);

  // --- Capped at what was actually paid as LTA ---------------------------

  const ltaPaid = Number(context.ltaComponentPaid);
  let exemptAmount = fareForEligible;

  if (Number.isFinite(ltaPaid) && ltaPaid >= 0) {
    if (ltaPaid === 0) {
      refusals.push({
        code: REFUSAL.NO_LTA_COMPONENT,
        message:
          'No LTA is paid in this salary structure, and the exemption cannot exceed what was paid',
      });
    } else if (fareForEligible > ltaPaid) {
      exemptAmount = round2(ltaPaid);
      notes.push(
        `Restricted to the LTA of ${round2(ltaPaid)} actually paid in the salary structure`,
      );
    }
  } else {
    notes.push(
      'No LTA component was supplied, so the exemption has not been restricted to the amount paid',
    );
  }

  const allowed = refusals.length === 0;

  return {
    allowed,
    block,
    position,
    usesCarryForward: allowed && usesCarryForward,
    entitlementRemaining: Math.max(0, entitlementRemaining),
    fare,
    travellers: { eligible, ineligible },
    exemptAmount: allowed ? round2(exemptAmount) : 0,
    taxableBalance:
      Number.isFinite(ltaPaid) && ltaPaid >= 0
        ? round2(Math.max(0, ltaPaid - (allowed ? exemptAmount : 0)))
        : null,
    refusals,
    notes,
  };
}

/**
 * The exemption an employee has taken across a block, for Form 16 Part B.
 *
 * @param {Array<object>} approvedClaims
 * @param {number} year any year in the block of interest
 * @returns {object}
 */
function blockSummary(approvedClaims, year) {
  const block = blockForYear(year);
  const claims = (Array.isArray(approvedClaims) ? approvedClaims : []).filter(
    (claim) => {
      const date = parseDate(claim.journeyDate);
      if (!date) return false;
      const claimYear = date.getUTCFullYear();
      return claimYear >= block.startYear && claimYear <= block.endYear;
    },
  );

  const exemptTotal = claims.reduce(
    (sum, claim) => sum + (Number(claim.exemptAmount) || 0),
    0,
  );

  return {
    block,
    journeysAvailed: claims.length,
    journeysRemaining: Math.max(0, JOURNEYS_PER_BLOCK - claims.length),
    exemptTotal: round2(exemptTotal),
    claims,
  };
}

module.exports = {
  BLOCK_ANCHOR_YEAR,
  BLOCK_LENGTH_YEARS,
  JOURNEYS_PER_BLOCK,
  TWO_CHILD_RULE_FROM,
  MAX_RESTRICTED_CHILDREN,
  TRAVEL_MODE,
  FARE_BASIS,
  FARE_BASIS_LABEL,
  RELATIONSHIP,
  REFUSAL,
  blockForYear,
  blockForDate,
  previousBlock,
  isFirstYearOfBlock,
  assessTravellers,
  computeJourneyFare,
  blockPosition,
  carryForwardUsable,
  assessClaim,
  blockSummary,
};
