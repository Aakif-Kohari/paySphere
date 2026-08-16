/**
 * Per-diem entitlement, policy checks and advance settlement (#1077).
 *
 * The cases with the most weight behind them are the ones where a naive
 * implementation gives a number that is *plausible* and wrong:
 *
 *   - a same-day trip counting as zero days,
 *   - the part-day rule being assumed rather than read from policy,
 *   - a settlement emitting a negative "recovery",
 *   - an unclassified city being paid a default rate silently.
 *
 * Times are UTC throughout, because the day-counting rules turn on whether a
 * departure is before or after noon and a local-zone comparison would give a
 * different answer per deployment.
 */

'use strict';

const {
  CITY_CLASS,
  PART_DAY_RULE,
  TRAVEL_MODE,
  SETTLEMENT_TYPE,
  round2,
  classifyCity,
  countEligibleDays,
  computeLegPerDiem,
  computeTripPerDiem,
  computeAdvanceCeiling,
  legsOverlap,
  detectPolicyViolations,
  settleTrip,
  outstandingAdvances,
} = require('../perDiemCalculator');

const policy = (overrides = {}) => ({
  grade: 'M3',
  perDiemRates: { A: 3000, B: 2000, C: 1200, International: 8000 },
  lodgingCaps: { A: 8000, B: 5000, C: 3000, International: 20000 },
  cityClasses: {
    A: ['Mumbai', 'Delhi', 'Bengaluru'],
    B: ['Pune', 'Jaipur'],
    C: ['Nashik'],
  },
  defaultCityClass: CITY_CLASS.C,
  permittedClasses: { Air: 'Economy', Rail: 'AC2', Road: 'Taxi' },
  partDayRule: PART_DAY_RULE.HALF,
  advanceCeilingPercent: 80,
  currency: 'INR',
  ...overrides,
});

/** A leg departing and returning at the given UTC hours. */
const leg = (overrides = {}) => ({
  fromCity: 'Chennai',
  toCity: 'Mumbai',
  departureAt: '2026-09-01T09:00:00.000Z',
  returnAt: '2026-09-03T18:00:00.000Z',
  mode: TRAVEL_MODE.AIR,
  travelClass: 'Economy',
  lodgingPerNight: 6000,
  ...overrides,
});

describe('round2', () => {
  it('rounds to two decimals and survives a non-number', () => {
    expect(round2(1200.456)).toBe(1200.46);
    expect(round2(undefined)).toBe(0);
  });
});

describe('classifyCity', () => {
  it('resolves a listed city to its class', () => {
    expect(classifyCity(leg({ toCity: 'Pune' }), policy()).cityClass).toBe(
      CITY_CLASS.B,
    );
  });

  it('matches case-insensitively and trims', () => {
    // These are typed by hand, and "  mumbai " is Mumbai.
    const result = classifyCity(leg({ toCity: '  mumbai ' }), policy());

    expect(result.cityClass).toBe(CITY_CLASS.A);
    expect(result.matched).toBe(true);
  });

  it('marks an international leg regardless of the city list', () => {
    expect(
      classifyCity(
        leg({ toCity: 'Singapore', isInternational: true }),
        policy(),
      ).cityClass,
    ).toBe(CITY_CLASS.INTERNATIONAL);
  });

  it('falls back to the cheapest domestic band for an unlisted city', () => {
    // Defaulting upwards would pay a metro rate for a year before anyone
    // noticed, because an unlisted city is usually a spelling mismatch.
    const result = classifyCity(leg({ toCity: 'Kochi' }), policy());

    expect(result.cityClass).toBe(CITY_CLASS.C);
    expect(result.matched).toBe(false);
  });

  it('says so rather than defaulting silently', () => {
    expect(classifyCity(leg({ toCity: 'Kochi' }), policy()).reason).toMatch(
      /not in the policy city list/,
    );
  });

  it('honours a policy that defaults upwards deliberately', () => {
    const result = classifyCity(
      leg({ toCity: 'Kochi' }),
      policy({ defaultCityClass: CITY_CLASS.B }),
    );

    expect(result.cityClass).toBe(CITY_CLASS.B);
  });
});

describe('countEligibleDays', () => {
  it('counts calendar days inclusive of both ends', () => {
    // 1 Sept 09:00 to 3 Sept 18:00 is three calendar days; the 09:00 departure
    // is a full day and the 18:00 return is a full day.
    const result = countEligibleDays(leg(), PART_DAY_RULE.HALF);

    expect(result.calendarDays).toBe(3);
    expect(result.days).toBe(3);
  });

  it('halves a departure at or after noon', () => {
    const result = countEligibleDays(
      leg({ departureAt: '2026-09-01T14:00:00.000Z' }),
      PART_DAY_RULE.HALF,
    );

    expect(result.days).toBe(2.5);
    expect(result.deductions[0]).toMatch(/after noon/);
  });

  it('halves a return before noon', () => {
    const result = countEligibleDays(
      leg({ returnAt: '2026-09-03T09:00:00.000Z' }),
      PART_DAY_RULE.HALF,
    );

    expect(result.days).toBe(2.5);
  });

  it('halves both ends of a late-out early-back trip', () => {
    const result = countEligibleDays(
      leg({
        departureAt: '2026-09-01T14:00:00.000Z',
        returnAt: '2026-09-03T09:00:00.000Z',
      }),
      PART_DAY_RULE.HALF,
    );

    expect(result.days).toBe(2);
  });

  it('treats noon itself as the afternoon', () => {
    // Boundary. "At or after noon" is the rule as written, and an off-by-one
    // here changes a half day for every trip departing at exactly 12:00.
    expect(
      countEligibleDays(
        leg({ departureAt: '2026-09-01T12:00:00.000Z' }),
        PART_DAY_RULE.HALF,
      ).days,
    ).toBe(2.5);
  });

  it('pays whole days at both ends under the full-day rule', () => {
    // The rule is a policy field precisely because companies differ. Burying
    // either answer makes the product wrong for whoever chose the other.
    const result = countEligibleDays(
      leg({
        departureAt: '2026-09-01T14:00:00.000Z',
        returnAt: '2026-09-03T09:00:00.000Z',
      }),
      PART_DAY_RULE.FULL,
    );

    expect(result.days).toBe(3);
    expect(result.deductions).toEqual([]);
  });

  it('never counts a same-day trip as zero', () => {
    // Out at 2pm, back at 9pm. They travelled, ate and spent; zero is the one
    // answer that is definitely wrong.
    const result = countEligibleDays(
      leg({
        departureAt: '2026-09-01T14:00:00.000Z',
        returnAt: '2026-09-01T21:00:00.000Z',
      }),
      PART_DAY_RULE.HALF,
    );

    expect(result.days).toBe(0.5);
  });

  it('counts a trip crossing midnight as two days, not as one', () => {
    // 23 elapsed hours, two travel days. Day counting is calendar-based for
    // exactly this case.
    const result = countEligibleDays(
      leg({
        departureAt: '2026-09-01T09:00:00.000Z',
        returnAt: '2026-09-02T08:00:00.000Z',
      }),
      PART_DAY_RULE.FULL,
    );

    expect(result.days).toBe(2);
  });

  it('refuses a return before the departure', () => {
    const result = countEligibleDays(
      leg({
        departureAt: '2026-09-05T09:00:00.000Z',
        returnAt: '2026-09-01T09:00:00.000Z',
      }),
      PART_DAY_RULE.HALF,
    );

    expect(result.valid).toBe(false);
  });

  it('refuses an unusable date', () => {
    expect(countEligibleDays(leg({ departureAt: 'soon' })).valid).toBe(false);
  });
});

describe('computeLegPerDiem', () => {
  it('multiplies eligible days by the class rate', () => {
    const result = computeLegPerDiem(leg(), policy());

    expect(result.cityClass).toBe(CITY_CLASS.A);
    expect(result.eligibleDays).toBe(3);
    expect(result.amount).toBe(9000);
  });

  it('applies the part-day deduction to the amount', () => {
    const result = computeLegPerDiem(
      leg({ departureAt: '2026-09-01T14:00:00.000Z' }),
      policy(),
    );

    expect(result.eligibleDays).toBe(2.5);
    expect(result.amount).toBe(7500);
  });

  it('reports rather than assumes when the policy has no rate for a class', () => {
    const result = computeLegPerDiem(
      leg({ toCity: 'Singapore', isInternational: true }),
      policy({ perDiemRates: { A: 3000, B: 2000, C: 1200 } }),
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(
      /no per-diem rate for city class International/,
    );
  });

  it('carries the classification reason through', () => {
    expect(
      computeLegPerDiem(leg({ toCity: 'Kochi' }), policy()).cityMatched,
    ).toBe(false);
  });
});

describe('computeTripPerDiem', () => {
  const trip = (legs) => ({ legs });

  it('sums the legs and returns the breakdown', () => {
    // The breakdown is returned because an employee disputing a per-diem is
    // disputing one leg of it, and a single total is not something anyone can
    // check.
    const result = computeTripPerDiem(
      trip([
        leg(),
        leg({
          toCity: 'Pune',
          departureAt: '2026-09-10T09:00:00.000Z',
          returnAt: '2026-09-11T18:00:00.000Z',
        }),
      ]),
      policy(),
    );

    expect(result.total).toBe(9000 + 4000);
    expect(result.legs).toHaveLength(2);
    expect(result.totalDays).toBe(5);
  });

  it('surfaces unclassified destinations at the trip level', () => {
    // The most common cause of a per-diem that looks wrong to the traveller, and
    // an approver should not have to read every leg to find it.
    const result = computeTripPerDiem(
      trip([leg({ toCity: 'Kochi' })]),
      policy(),
    );

    expect(result.unclassifiedCities).toEqual(['Kochi']);
  });

  it('fails the whole trip when a leg cannot be computed', () => {
    const result = computeTripPerDiem(
      trip([leg(), leg({ returnAt: 'whenever' })]),
      policy(),
    );

    expect(result.valid).toBe(false);
    expect(result.total).toBe(0);
  });

  it('refuses a trip with no legs', () => {
    expect(computeTripPerDiem(trip([]), policy()).valid).toBe(false);
  });
});

describe('computeAdvanceCeiling', () => {
  it('applies the policy percentage', () => {
    expect(computeAdvanceCeiling(50000, policy()).ceiling).toBe(40000);
  });

  it('treats a missing percentage as 80', () => {
    expect(computeAdvanceCeiling(50000, {}).ceiling).toBe(40000);
  });

  it('clamps a nonsensical percentage into range', () => {
    expect(
      computeAdvanceCeiling(50000, { advanceCeilingPercent: 250 }).ceiling,
    ).toBe(50000);
    expect(
      computeAdvanceCeiling(50000, { advanceCeilingPercent: -10 }).ceiling,
    ).toBe(0);
  });
});

describe('legsOverlap', () => {
  it('detects an overlap', () => {
    expect(
      legsOverlap(
        leg({
          departureAt: '2026-09-01T09:00:00Z',
          returnAt: '2026-09-05T09:00:00Z',
        }),
        leg({
          departureAt: '2026-09-03T09:00:00Z',
          returnAt: '2026-09-07T09:00:00Z',
        }),
      ),
    ).toBe(true);
  });

  it('does not treat a connection as an overlap', () => {
    // One leg ending exactly when the next begins is a connection, not a person
    // in two cities at once.
    expect(
      legsOverlap(
        leg({
          departureAt: '2026-09-01T09:00:00Z',
          returnAt: '2026-09-03T18:00:00Z',
        }),
        leg({
          departureAt: '2026-09-03T18:00:00Z',
          returnAt: '2026-09-05T18:00:00Z',
        }),
      ),
    ).toBe(false);
  });
});

describe('detectPolicyViolations', () => {
  const request = (overrides = {}) => ({
    legs: [leg()],
    estimatedCost: 50000,
    advanceRequested: 0,
    ...overrides,
  });

  it('passes a compliant trip', () => {
    expect(
      detectPolicyViolations(
        request({ legs: [leg({ lodgingPerNight: 7000 })] }),
        policy(),
      ),
    ).toEqual([]);
  });

  it('flags a travel class above the grade entitlement', () => {
    const violations = detectPolicyViolations(
      request({
        legs: [leg({ travelClass: 'Business', lodgingPerNight: 7000 })],
      }),
      policy(),
    );

    expect(violations[0].type).toBe('travel-class-above-entitlement');
    expect(violations[0].permitted).toBe('Economy');
  });

  it('allows a class below the entitlement', () => {
    // Booking down is not a breach.
    const violations = detectPolicyViolations(
      request({
        legs: [
          leg({ mode: 'Rail', travelClass: 'AC3', lodgingPerNight: 7000 }),
        ],
      }),
      policy(),
    );

    expect(violations).toEqual([]);
  });

  it('flags an unrecognised travel class rather than passing it', () => {
    const violations = detectPolicyViolations(
      request({
        legs: [leg({ travelClass: 'SuperSaver', lodgingPerNight: 7000 })],
      }),
      policy(),
    );

    expect(violations[0].type).toBe('unknown-travel-class');
  });

  it('flags lodging over the city cap with the overage', () => {
    // "Over the cap" without a number is not something an approver can weigh.
    const violations = detectPolicyViolations(
      request({ legs: [leg({ lodgingPerNight: 9500 })] }),
      policy(),
    );

    expect(violations[0].type).toBe('lodging-over-cap');
    expect(violations[0].overage).toBe(1500);
  });

  it('uses the destination class cap, not a flat one', () => {
    // ₹4,000 is fine in Mumbai (class A cap 8,000) and over in Nashik (class C
    // cap 3,000).
    const inMetro = detectPolicyViolations(
      request({ legs: [leg({ toCity: 'Mumbai', lodgingPerNight: 4000 })] }),
      policy(),
    );
    const inTier3 = detectPolicyViolations(
      request({ legs: [leg({ toCity: 'Nashik', lodgingPerNight: 4000 })] }),
      policy(),
    );

    expect(inMetro).toEqual([]);
    expect(inTier3[0].type).toBe('lodging-over-cap');
  });

  it('flags overlapping legs', () => {
    const violations = detectPolicyViolations(
      request({
        legs: [
          leg({
            departureAt: '2026-09-01T09:00:00Z',
            returnAt: '2026-09-05T09:00:00Z',
            lodgingPerNight: 7000,
          }),
          leg({
            departureAt: '2026-09-03T09:00:00Z',
            returnAt: '2026-09-07T09:00:00Z',
            lodgingPerNight: 7000,
          }),
        ],
      }),
      policy(),
    );

    expect(violations.some((v) => v.type === 'overlapping-legs')).toBe(true);
  });

  it('flags an advance over the ceiling with the numbers', () => {
    const violations = detectPolicyViolations(
      request({
        advanceRequested: 45000,
        legs: [leg({ lodgingPerNight: 7000 })],
      }),
      policy(),
    );

    expect(violations[0].type).toBe('advance-over-ceiling');
    expect(violations[0].ceiling).toBe(40000);
    expect(violations[0].overage).toBe(5000);
  });

  it('reports every breach rather than the first', () => {
    const violations = detectPolicyViolations(
      request({
        advanceRequested: 45000,
        legs: [leg({ travelClass: 'First', lodgingPerNight: 20000 })],
      }),
      policy(),
    );

    expect(violations.map((v) => v.type).sort()).toEqual([
      'advance-over-ceiling',
      'lodging-over-cap',
      'travel-class-above-entitlement',
    ]);
  });
});

describe('settleTrip', () => {
  it('reimburses when the spend exceeds the advance', () => {
    const result = settleTrip({
      advanceReleased: 30000,
      actuals: { airfare: 18000, lodging: 12000 },
      perDiemEntitlement: 9000,
    });

    expect(result.type).toBe(SETTLEMENT_TYPE.REIMBURSEMENT);
    expect(result.reimbursementAmount).toBe(9000);
    expect(result.recoveryAmount).toBe(0);
    expect(result.payrollComponent).toBe('travel_reimbursement');
  });

  it('recovers when the advance exceeds the spend', () => {
    // The ₹8,500 hole this feature exists to close.
    const result = settleTrip({
      advanceReleased: 40000,
      actuals: { airfare: 18000, lodging: 10000 },
      perDiemEntitlement: 3500,
    });

    expect(result.type).toBe(SETTLEMENT_TYPE.RECOVERY);
    expect(result.recoveryAmount).toBe(8500);
    expect(result.payrollComponent).toBe('travel_advance_recovery');
  });

  it('reports an exact match as settled with nothing to post', () => {
    const result = settleTrip({
      advanceReleased: 30000,
      actuals: { airfare: 21000 },
      perDiemEntitlement: 9000,
    });

    expect(result.type).toBe(SETTLEMENT_TYPE.SETTLED);
    expect(result.reimbursementAmount).toBe(0);
    expect(result.recoveryAmount).toBe(0);
    expect(result.payrollComponent).toBeNull();
  });

  it('never emits a negative recovery', () => {
    // A caller posting `recoveryAmount` as a payroll deduction must never be
    // handed a negative. Both figures are non-negative by construction.
    const result = settleTrip({
      advanceReleased: 0,
      actuals: { airfare: 5000 },
      perDiemEntitlement: 1200,
    });

    expect(result.recoveryAmount).toBe(0);
    expect(result.reimbursementAmount).toBeGreaterThan(0);
  });

  it('pays the per-diem even when nothing was receipted', () => {
    // That is what makes it a per-diem rather than a reimbursement.
    const result = settleTrip({
      advanceReleased: 0,
      actuals: {},
      perDiemEntitlement: 4500,
    });

    expect(result.payable).toBe(4500);
    expect(result.type).toBe(SETTLEMENT_TYPE.REIMBURSEMENT);
  });

  it('drops zero and negative expense heads', () => {
    const result = settleTrip({
      advanceReleased: 0,
      actuals: { airfare: 5000, misc: 0, refund: -100 },
      perDiemEntitlement: 0,
    });

    expect(result.actualsByHead).toHaveLength(1);
    expect(result.actualsTotal).toBe(5000);
  });

  it('treats a negative advance as zero rather than inflating the payout', () => {
    const result = settleTrip({
      advanceReleased: -5000,
      actuals: { airfare: 5000 },
      perDiemEntitlement: 0,
    });

    expect(result.advanceReleased).toBe(0);
    expect(result.reimbursementAmount).toBe(5000);
  });
});

describe('outstandingAdvances', () => {
  const asOf = '2026-09-30T00:00:00.000Z';

  const request = (id, released, releasedAt) => ({
    _id: id,
    employeeId: `emp-${id}`,
    purpose: 'Client visit',
    advanceReleased: released,
    advanceReleasedAt: releasedAt,
  });

  it('lists advances that have not been settled', () => {
    const result = outstandingAdvances(
      [request('r1', 40000, '2026-09-01'), request('r2', 20000, '2026-08-01')],
      [{ requestId: 'r2' }],
      asOf,
    );

    expect(result.count).toBe(1);
    expect(result.totalOutstanding).toBe(40000);
  });

  it('ignores a trip that was never funded', () => {
    expect(
      outstandingAdvances([request('r1', 0, '2026-09-01')], [], asOf).count,
    ).toBe(0);
  });

  it('buckets by age for a receivables report', () => {
    const result = outstandingAdvances(
      [
        request('r1', 10000, '2026-09-20'), // 10 days
        request('r2', 20000, '2026-08-15'), // 46 days
        request('r3', 30000, '2026-05-01'), // 152 days
      ],
      [],
      asOf,
    );

    expect(result.byBucket['0-30']).toBe(10000);
    expect(result.byBucket['31-60']).toBe(20000);
    expect(result.byBucket['90+']).toBe(30000);
  });

  it('puts the oldest advance first', () => {
    const result = outstandingAdvances(
      [request('r1', 10000, '2026-09-20'), request('r2', 30000, '2026-05-01')],
      [],
      asOf,
    );

    expect(result.advances[0].requestId).toBe('r2');
  });

  it('buckets an advance with no release date as unknown rather than dropping it', () => {
    const result = outstandingAdvances(
      [request('r1', 10000, undefined)],
      [],
      asOf,
    );

    expect(result.count).toBe(1);
    expect(result.advances[0].bucket).toBe('unknown');
  });

  it('reports an empty ledger cleanly', () => {
    const result = outstandingAdvances([], [], asOf);

    expect(result.count).toBe(0);
    expect(result.totalOutstanding).toBe(0);
  });
});
