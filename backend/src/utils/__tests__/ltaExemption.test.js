/**
 * The LTA rules that are easy to state and easy to implement wrongly (#1345).
 *
 * Every one of these has a plausible wrong answer — the block keyed on the
 * financial year, the carry-forward available "in the next block", the third
 * child who is actually a twin — and none of them fails loudly. They produce an
 * exemption that is simply the wrong size.
 */

const {
  JOURNEYS_PER_BLOCK,
  TRAVEL_MODE,
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
} = require('../ltaExemption');

const approved = (journeyDate, exemptAmount = 0) => ({
  journeyDate,
  status: 'approved',
  exemptAmount,
});

describe('blockForYear', () => {
  it('places the current statutory blocks where the statute puts them', () => {
    expect(blockForYear(2022).label).toBe('2022-2025');
    expect(blockForYear(2025).label).toBe('2022-2025');
    expect(blockForYear(2026).label).toBe('2026-2029');
  });

  it('derives blocks rather than reading them from a table that ends', () => {
    expect(blockForYear(2030).label).toBe('2030-2033');
    expect(blockForYear(2099).label).toBe('2098-2101');
  });

  it('refuses a year before the scheme existed', () => {
    expect(() => blockForYear(1985)).toThrow(RangeError);
  });
});

describe('blockForDate', () => {
  it('keys on the calendar year of travel, not the financial year', () => {
    // A February 2026 journey is in the 2026-2029 block. Reading it as
    // FY 2025-26 would put it in 2022-2025 and give the employee a journey
    // back that they have not got.
    expect(blockForDate('2026-02-14').label).toBe('2026-2029');

    // And the mirror: a December 2025 journey stays in 2022-2025.
    expect(blockForDate('2025-12-28').label).toBe('2022-2025');
  });

  it('refuses an unparseable date', () => {
    expect(() => blockForDate('not a date')).toThrow(RangeError);
  });
});

describe('previousBlock and isFirstYearOfBlock', () => {
  it('steps back a whole block', () => {
    expect(previousBlock(blockForYear(2026)).label).toBe('2022-2025');
  });

  it('recognises only the first calendar year', () => {
    expect(isFirstYearOfBlock(2026)).toBe(true);
    expect(isFirstYearOfBlock(2027)).toBe(false);
    expect(isFirstYearOfBlock(2029)).toBe(false);
  });
});

describe('assessTravellers', () => {
  it('allows the employee, spouse and children', () => {
    const { eligible, ineligible } = assessTravellers([
      { name: 'Self', relationship: RELATIONSHIP.SELF },
      { name: 'Spouse', relationship: RELATIONSHIP.SPOUSE },
      {
        name: 'Child',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2015-01-01',
      },
    ]);

    expect(eligible).toHaveLength(3);
    expect(ineligible).toHaveLength(0);
  });

  it('refuses a parent who is not dependent', () => {
    const { ineligible } = assessTravellers([
      { name: 'Father', relationship: RELATIONSHIP.PARENT, dependent: false },
    ]);

    expect(ineligible).toHaveLength(1);
    expect(ineligible[0].reason).toMatch(/dependent/i);
  });

  it('allows a dependent parent', () => {
    const { eligible } = assessTravellers([
      { name: 'Mother', relationship: RELATIONSHIP.PARENT, dependent: true },
    ]);

    expect(eligible).toHaveLength(1);
  });

  it('refuses a relationship the statute does not cover', () => {
    const { ineligible } = assessTravellers([
      { name: 'Cousin', relationship: 'cousin' },
    ]);

    expect(ineligible[0].reason).toMatch(/section 10\(5\)/);
  });

  it('refuses a third child born after the cut-off', () => {
    const { eligible, ineligible } = assessTravellers([
      {
        name: 'A',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2012-01-01',
      },
      {
        name: 'B',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2014-01-01',
      },
      {
        name: 'C',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2016-01-01',
      },
    ]);

    expect(eligible).toHaveLength(2);
    expect(ineligible[0].name).toBe('C');
    expect(ineligible[0].reason).toMatch(/two-child restriction/i);
  });

  it('does not count children born before 1 October 1998 against the limit', () => {
    const { eligible, ineligible } = assessTravellers([
      {
        name: 'Older',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '1997-06-01',
      },
      {
        name: 'A',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2012-01-01',
      },
      {
        name: 'B',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2014-01-01',
      },
    ]);

    expect(eligible).toHaveLength(3);
    expect(ineligible).toHaveLength(0);
  });

  it('treats a multiple birth after the first child as one child', () => {
    // First child, then twins. Three children, and the restriction is not
    // breached — refusing the third is the wrong answer that looks right.
    const { eligible, ineligible } = assessTravellers([
      {
        name: 'First',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2012-01-01',
      },
      {
        name: 'Twin A',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2015-03-04',
        birthGroupId: 'twins-2015',
      },
      {
        name: 'Twin B',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2015-03-04',
        birthGroupId: 'twins-2015',
      },
    ]);

    expect(eligible).toHaveLength(3);
    expect(ineligible).toHaveLength(0);
  });

  it('still refuses a fourth child when the third was a twin', () => {
    const { ineligible } = assessTravellers([
      {
        name: 'First',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2012-01-01',
      },
      {
        name: 'Twin A',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2015-03-04',
        birthGroupId: 'twins-2015',
      },
      {
        name: 'Twin B',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2015-03-04',
        birthGroupId: 'twins-2015',
      },
      {
        name: 'Fourth',
        relationship: RELATIONSHIP.CHILD,
        dateOfBirth: '2018-01-01',
      },
    ]);

    expect(ineligible).toHaveLength(1);
    expect(ineligible[0].name).toBe('Fourth');
  });
});

describe('computeJourneyFare', () => {
  it('caps air travel at the economy fare', () => {
    const fare = computeJourneyFare({
      mode: TRAVEL_MODE.AIR,
      claimedFare: 84000,
      fareCeilings: { economyAirFare: 31000 },
    });

    expect(fare.exemptFare).toBe(31000);
    expect(fare.capApplied).toBe(true);
    expect(fare.note).toMatch(/economy class fare/);
  });

  it('leaves a fare within the ceiling alone', () => {
    const fare = computeJourneyFare({
      mode: TRAVEL_MODE.RAIL,
      claimedFare: 9000,
      fareCeilings: { acFirstClassRailFare: 12000 },
    });

    expect(fare.exemptFare).toBe(9000);
    expect(fare.capApplied).toBe(false);
  });

  it('falls back to AC first class rail where a place is connected by neither air nor rail', () => {
    const fare = computeJourneyFare({
      mode: TRAVEL_MODE.OTHER,
      claimedFare: 15000,
      fareCeilings: { acFirstClassRailFare: 10000 },
    });

    expect(fare.basis).toBe('acFirstClassRailFare');
    expect(fare.exemptFare).toBe(10000);
  });

  it('flags rather than hides an uncapped fare', () => {
    const fare = computeJourneyFare({
      mode: TRAVEL_MODE.AIR,
      claimedFare: 84000,
      fareCeilings: {},
    });

    expect(fare.capUnverified).toBe(true);
    expect(fare.exemptFare).toBe(84000);
    expect(fare.note).toMatch(/has not been capped/);
  });

  it('returns nil for a journey with no usable fare', () => {
    expect(computeJourneyFare({ mode: TRAVEL_MODE.RAIL }).exemptFare).toBe(0);
  });
});

describe('blockPosition', () => {
  const block = blockForYear(2026);

  it('counts approved journeys in the block', () => {
    const position = blockPosition(
      [approved('2026-05-01'), approved('2027-05-01')],
      block,
    );

    expect(position.availedInBlock).toBe(2);
  });

  it('ignores journeys still awaiting verification', () => {
    // A claim sitting in the queue has consumed nothing. Counting it would make
    // an employee's second journey depend on how fast HR is working.
    const position = blockPosition(
      [
        approved('2026-05-01'),
        { journeyDate: '2027-05-01', status: 'pending' },
      ],
      block,
    );

    expect(position.availedInBlock).toBe(1);
  });

  it('finds one journey carried forward when the previous block was underused', () => {
    const position = blockPosition([approved('2023-05-01')], block);

    expect(position.availedInPreviousBlock).toBe(1);
    expect(position.carryForwardAvailable).toBe(1);
  });

  it('carries at most one forward however many went unused', () => {
    const position = blockPosition([], block);

    expect(position.availedInPreviousBlock).toBe(0);
    expect(position.carryForwardAvailable).toBe(1);
  });

  it('carries nothing forward from a fully used block', () => {
    const position = blockPosition(
      [approved('2022-05-01'), approved('2024-05-01')],
      block,
    );

    expect(position.carryForwardAvailable).toBe(0);
  });
});

describe('carryForwardUsable', () => {
  const position = blockPosition([approved('2023-05-01')], blockForYear(2026));

  it('is available in the first year of the block', () => {
    expect(carryForwardUsable(2026, position)).toBe(true);
  });

  it('is not available in any later year of the block', () => {
    // The rule most often got wrong: "available in the next block" is not what
    // the statute says. It is the first year of the next block and no other.
    expect(carryForwardUsable(2027, position)).toBe(false);
    expect(carryForwardUsable(2029, position)).toBe(false);
  });
});

describe('assessClaim', () => {
  const journey = (overrides = {}) => ({
    journeyDate: '2026-06-01',
    mode: TRAVEL_MODE.AIR,
    claimedFare: 40000,
    fareCeilings: { economyAirFare: 40000 },
    travellers: [
      { name: 'Self', relationship: RELATIONSHIP.SELF },
      { name: 'Spouse', relationship: RELATIONSHIP.SPOUSE },
    ],
    ...overrides,
  });

  it('allows a first journey in a fresh block', () => {
    const result = assessClaim(journey(), {
      history: [],
      ltaComponentPaid: 60000,
    });

    expect(result.allowed).toBe(true);
    expect(result.exemptAmount).toBe(40000);
    expect(result.block.label).toBe('2026-2029');
  });

  it('refuses a third journey in a block', () => {
    const result = assessClaim(journey({ journeyDate: '2028-06-01' }), {
      history: [
        approved('2026-01-01'),
        approved('2027-01-01'),
        approved('2022-01-01'),
        approved('2023-01-01'),
      ],
      ltaComponentPaid: 60000,
    });

    expect(result.allowed).toBe(false);
    expect(result.refusals[0].code).toBe(REFUSAL.BLOCK_EXHAUSTED);
    expect(result.exemptAmount).toBe(0);
  });

  it('allows a third journey in the first year of a block when one is carried forward', () => {
    const result = assessClaim(journey({ journeyDate: '2026-06-01' }), {
      history: [
        approved('2026-01-01'),
        approved('2026-03-01'),
        approved('2023-01-01'),
      ],
      ltaComponentPaid: 60000,
    });

    expect(result.allowed).toBe(true);
    expect(result.usesCarryForward).toBe(true);
    expect(result.notes.join(' ')).toMatch(/carried forward/);
  });

  it('refuses the same claim a year later, when the carry-forward has lapsed', () => {
    const result = assessClaim(journey({ journeyDate: '2027-06-01' }), {
      history: [
        approved('2026-01-01'),
        approved('2026-03-01'),
        approved('2023-01-01'),
      ],
      ltaComponentPaid: 60000,
    });

    expect(result.allowed).toBe(false);
    expect(result.refusals[0].message).toMatch(
      /could only have been taken in 2026/,
    );
  });

  it('refuses a journey with a foreign leg outright', () => {
    const result = assessClaim(journey({ international: true }), {
      history: [],
      ltaComponentPaid: 60000,
    });

    expect(result.allowed).toBe(false);
    expect(result.refusals.some((r) => r.code === REFUSAL.INTERNATIONAL)).toBe(
      true,
    );
  });

  it('caps the exemption at the LTA actually paid, not at what the journey cost', () => {
    const result = assessClaim(
      journey({ claimedFare: 50000, fareCeilings: { economyAirFare: 50000 } }),
      {
        history: [],
        ltaComponentPaid: 18000,
      },
    );

    expect(result.exemptAmount).toBe(18000);
    expect(result.taxableBalance).toBe(0);
    expect(result.notes.join(' ')).toMatch(/actually paid/);
  });

  it('reports the taxable balance when the fare falls short of the LTA paid', () => {
    const result = assessClaim(
      journey({ claimedFare: 25000, fareCeilings: { economyAirFare: 25000 } }),
      {
        history: [],
        ltaComponentPaid: 60000,
      },
    );

    expect(result.exemptAmount).toBe(25000);
    expect(result.taxableBalance).toBe(35000);
  });

  it('refuses when no LTA is paid in the salary structure', () => {
    const result = assessClaim(journey(), {
      history: [],
      ltaComponentPaid: 0,
    });

    expect(result.allowed).toBe(false);
    expect(
      result.refusals.some((r) => r.code === REFUSAL.NO_LTA_COMPONENT),
    ).toBe(true);
  });

  it('apportions the fare rather than voiding the journey when a traveller is ineligible', () => {
    const result = assessClaim(
      journey({
        claimedFare: 40000,
        fareCeilings: { economyAirFare: 40000 },
        travellers: [
          { name: 'Self', relationship: RELATIONSHIP.SELF },
          { name: 'Spouse', relationship: RELATIONSHIP.SPOUSE },
          { name: 'Cousin', relationship: 'cousin' },
          { name: 'Friend', relationship: 'friend' },
        ],
      }),
      { history: [], ltaComponentPaid: 60000 },
    );

    expect(result.allowed).toBe(true);
    expect(result.exemptAmount).toBe(20000);
    expect(result.travellers.ineligible).toHaveLength(2);
  });

  it('refuses a journey where nobody is eligible', () => {
    const result = assessClaim(
      journey({
        travellers: [{ name: 'Friend', relationship: 'friend' }],
      }),
      { history: [], ltaComponentPaid: 60000 },
    );

    expect(result.allowed).toBe(false);
    expect(
      result.refusals.some((r) => r.code === REFUSAL.NO_ELIGIBLE_TRAVELLER),
    ).toBe(true);
  });

  it('refuses an unparseable journey date without throwing', () => {
    const result = assessClaim({ journeyDate: 'nonsense' }, {});

    expect(result.allowed).toBe(false);
    expect(result.refusals[0].code).toBe(REFUSAL.INVALID_JOURNEY);
  });

  it('says so when the exemption has not been restricted to what was paid', () => {
    const result = assessClaim(journey(), { history: [] });

    expect(result.taxableBalance).toBeNull();
    expect(result.notes.join(' ')).toMatch(/not been restricted/);
  });
});

describe('blockSummary', () => {
  it('totals the exemption taken across a block', () => {
    const summary = blockSummary(
      [
        approved('2026-05-01', 31000),
        approved('2028-05-01', 22000),
        approved('2023-05-01', 9000),
      ],
      2027,
    );

    expect(summary.block.label).toBe('2026-2029');
    expect(summary.journeysAvailed).toBe(2);
    expect(summary.journeysRemaining).toBe(0);
    expect(summary.exemptTotal).toBe(53000);
  });

  it('reports the journeys still available in a part-used block', () => {
    const summary = blockSummary([approved('2026-05-01', 31000)], 2026);

    expect(summary.journeysRemaining).toBe(JOURNEYS_PER_BLOCK - 1);
  });

  it('handles a block with nothing in it', () => {
    const summary = blockSummary([], 2030);

    expect(summary.journeysAvailed).toBe(0);
    expect(summary.exemptTotal).toBe(0);
  });
});
