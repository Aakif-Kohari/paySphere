/**
 * The Payment of Bonus Act boundaries (#1346).
 *
 * Two of these are the reason the module exists at all — the section 12 wage
 * cap, and the set-on/set-off ledger, which needs a memory that a once-a-year
 * script does not have.
 */

const {
  ELIGIBILITY_WAGE_CEILING,
  CALCULATION_WAGE_FLOOR,
  MIN_BONUS_RATE,
  MAX_BONUS_RATE,
  SET_ON_SET_OFF_YEARS,
  DISQUALIFICATION,
  EXCLUSION,
  isEstablishmentCovered,
  qualifyingWage,
  assessEligibility,
  computeQualifyingWages,
  computeAvailableSurplus,
  computeAllocableSurplus,
  expireLedger,
  allocate,
  applyToLedger,
  paymentDueDate,
  computeBonusRegister,
} = require('../statutoryBonus');

/** Twelve full months at a flat wage. */
const fullYear = (wage) =>
  Array.from({ length: 12 }, (unused, index) => ({
    month: index + 1,
    daysWorked: 26,
    wage,
  }));

const employee = (overrides = {}) => ({
  employeeId: `emp-${overrides.name || 'x'}`,
  name: 'Test Employee',
  designation: 'Operator',
  monthlyWage: 15000,
  months: fullYear(15000),
  ...overrides,
});

describe('isEstablishmentCovered', () => {
  it('applies at twenty employees', () => {
    expect(isEstablishmentCovered({ headcount: 20 }).covered).toBe(true);
  });

  it('does not apply below twenty', () => {
    expect(isEstablishmentCovered({ headcount: 19 }).covered).toBe(false);
  });

  it('keeps applying after the headcount falls back below twenty', () => {
    // Section 1(5). A plain `headcount >= 20` check every year tells a company
    // that shrank that it has stopped owing statutory bonus, and it has not.
    const result = isEstablishmentCovered({
      headcount: 14,
      previouslyCovered: true,
    });

    expect(result.covered).toBe(true);
    expect(result.reason).toMatch(/section 1\(5\)/i);
  });
});

describe('qualifyingWage — section 12', () => {
  it('caps a wage above the floor at the floor', () => {
    expect(qualifyingWage(18000)).toBe(CALCULATION_WAGE_FLOOR);
  });

  it('leaves a wage below the floor alone — the cap is not a floor for the low paid', () => {
    expect(qualifyingWage(5000)).toBe(5000);
  });

  it('uses the scheduled minimum wage when it exceeds the statutory floor', () => {
    // The `max` inside the `min`. Dropping it understates the bonus everywhere
    // the scheduled minimum wage is above ₹7,000, which is most states for
    // skilled categories.
    expect(qualifyingWage(18000, 11500)).toBe(11500);
  });

  it('ignores a scheduled minimum wage below the statutory floor', () => {
    expect(qualifyingWage(18000, 5200)).toBe(CALCULATION_WAGE_FLOOR);
  });

  it('returns nil for an unusable wage', () => {
    expect(qualifyingWage(0)).toBe(0);
    expect(qualifyingWage('nonsense')).toBe(0);
  });
});

describe('assessEligibility', () => {
  it('includes an employee under the ceiling with a full year', () => {
    expect(assessEligibility(employee()).eligible).toBe(true);
  });

  it('excludes an employee above the section 2(13) ceiling', () => {
    const result = assessEligibility(
      employee({ monthlyWage: ELIGIBILITY_WAGE_CEILING + 1 }),
    );

    expect(result.eligible).toBe(false);
    expect(result.exclusion.code).toBe(EXCLUSION.WAGE_CEILING);
  });

  it('includes an employee exactly at the ceiling', () => {
    expect(
      assessEligibility(employee({ monthlyWage: ELIGIBILITY_WAGE_CEILING }))
        .eligible,
    ).toBe(true);
  });

  it('tests the ceiling on the paid wage, not on the capped one', () => {
    // Testing the capped wage would make everybody eligible, because the cap is
    // ₹7,000 and the ceiling is ₹21,000.
    const result = assessEligibility(employee({ monthlyWage: 35000 }));

    expect(result.eligible).toBe(false);
  });

  it('excludes an employee below the thirty-day minimum', () => {
    const result = assessEligibility(
      employee({ months: [{ month: 3, daysWorked: 18, wage: 15000 }] }),
    );

    expect(result.eligible).toBe(false);
    expect(result.exclusion.code).toBe(EXCLUSION.INSUFFICIENT_DAYS);
  });

  it('includes an employee at exactly thirty days', () => {
    const result = assessEligibility(
      employee({
        months: [
          { month: 3, daysWorked: 15, wage: 15000 },
          { month: 4, daysWorked: 15, wage: 15000 },
        ],
      }),
    );

    expect(result.eligible).toBe(true);
  });

  it('forfeits a bonus under section 9', () => {
    const result = assessEligibility(
      employee({ disqualification: DISQUALIFICATION.THEFT }),
    );

    expect(result.eligible).toBe(false);
    expect(result.exclusion.code).toBe(EXCLUSION.DISQUALIFIED);
    expect(result.exclusion.message).toMatch(/theft/i);
  });

  it('reports a missing wage rather than treating it as zero', () => {
    const result = assessEligibility(employee({ monthlyWage: null }));

    expect(result.exclusion.code).toBe(EXCLUSION.NO_WAGE_DATA);
  });
});

describe('computeQualifyingWages', () => {
  it('sums the capped wage month by month', () => {
    const wages = computeQualifyingWages(employee());

    expect(wages.total).toBe(CALCULATION_WAGE_FLOOR * 12);
    expect(wages.months).toHaveLength(12);
    expect(wages.months[0].capped).toBe(true);
  });

  it('pro-rates a mid-year joiner without a separate rule', () => {
    const wages = computeQualifyingWages(
      employee({ months: fullYear(15000).slice(7) }),
    );

    expect(wages.total).toBe(CALCULATION_WAGE_FLOOR * 5);
  });

  it('caps each side of a mid-year revision separately', () => {
    const wages = computeQualifyingWages(
      employee({
        monthlyWage: 9000,
        months: [
          ...Array.from({ length: 6 }, (unused, i) => ({
            month: i + 1,
            daysWorked: 26,
            wage: 6000,
          })),
          ...Array.from({ length: 6 }, (unused, i) => ({
            month: i + 7,
            daysWorked: 26,
            wage: 9000,
          })),
        ],
      }),
    );

    // Six months below the cap at their real wage, six months at the cap.
    expect(wages.total).toBe(6 * 6000 + 6 * CALCULATION_WAGE_FLOOR);
  });
});

describe('computeAvailableSurplus and computeAllocableSurplus', () => {
  it('deducts the section 6 prior charges', () => {
    const surplus = computeAvailableSurplus({
      grossProfit: 5000000,
      depreciation: 800000,
      directTax: 1200000,
    });

    expect(surplus.priorCharges).toBe(2000000);
    expect(surplus.availableSurplus).toBe(3000000);
  });

  it('floors a loss year at nil rather than going negative', () => {
    const surplus = computeAvailableSurplus({
      grossProfit: 500000,
      directTax: 900000,
    });

    expect(surplus.availableSurplus).toBe(0);
  });

  it('allocates 67% for a company', () => {
    expect(computeAllocableSurplus(3000000).allocableSurplus).toBe(2010000);
  });

  it('allocates 60% in any other case', () => {
    expect(computeAllocableSurplus(3000000, 'OTHER').allocableSurplus).toBe(
      1800000,
    );
  });
});

describe('expireLedger', () => {
  it('drops entries older than the four succeeding accounting years', () => {
    const { live, expired } = expireLedger(
      [
        { accountingYear: 2021, type: 'set_on', amount: 100 },
        { accountingYear: 2022, type: 'set_on', amount: 200 },
        { accountingYear: 2025, type: 'set_on', amount: 300 },
      ],
      2026,
    );

    expect(expired).toHaveLength(1);
    expect(expired[0].accountingYear).toBe(2021);
    expect(live).toHaveLength(2);
  });

  it('keeps an entry in the last of its four succeeding years', () => {
    // Set on in 2022, so available in 2023, 2024, 2025 and 2026 — and gone
    // when 2027 is computed. Expiring it a year early turns a set-off into a
    // set-on that never existed.
    const year = 2026 - SET_ON_SET_OFF_YEARS;

    expect(
      expireLedger(
        [{ accountingYear: year, type: 'set_on', amount: 100 }],
        2026,
      ).live,
    ).toHaveLength(1);

    expect(
      expireLedger(
        [{ accountingYear: year, type: 'set_on', amount: 100 }],
        2027,
      ).expired,
    ).toHaveLength(1);
  });
});

describe('allocate', () => {
  const wages = 1200000;

  it('pays the minimum in a year with no surplus at all', () => {
    // Section 10. The minimum is payable whether or not there is a surplus,
    // which is the whole reason a loss year is not simply nil.
    const result = allocate({
      allocableSurplus: 0,
      totalQualifyingWages: wages,
      accountingYear: 2026,
    });

    expect(result.payableBonus).toBe(result.minimumBonus);
    expect(result.bonusPercent).toBeCloseTo(MIN_BONUS_RATE * 100, 2);
    expect(result.setOff).toBe(result.minimumBonus);
  });

  it('pays the surplus in full between the minimum and the maximum', () => {
    const result = allocate({
      allocableSurplus: 180000,
      totalQualifyingWages: wages,
      accountingYear: 2026,
    });

    expect(result.payableBonus).toBe(180000);
    expect(result.setOn).toBe(0);
    expect(result.setOff).toBe(0);
  });

  it('caps at the section 11 maximum and sets on the excess', () => {
    const result = allocate({
      allocableSurplus: 400000,
      totalQualifyingWages: wages,
      accountingYear: 2026,
    });

    expect(result.payableBonus).toBe(wages * MAX_BONUS_RATE);
    expect(result.setOn).toBe(400000 - wages * MAX_BONUS_RATE);
    expect(result.bonusPercent).toBeCloseTo(20, 2);
  });

  it('draws on carried set-on before setting anything off', () => {
    const result = allocate({
      allocableSurplus: 50000,
      totalQualifyingWages: wages,
      accountingYear: 2026,
      ledger: [{ accountingYear: 2024, type: 'set_on', amount: 40000 }],
    });

    expect(result.drawnFromSetOn).toBe(40000);
    expect(result.payableBonus).toBe(result.minimumBonus);
    expect(result.setOff).toBe(
      Math.round((result.minimumBonus - 50000 - 40000 + Number.EPSILON) * 100) /
        100,
    );
  });

  it('sets nothing off when carried set-on covers the whole shortfall', () => {
    const result = allocate({
      allocableSurplus: 50000,
      totalQualifyingWages: wages,
      accountingYear: 2026,
      ledger: [{ accountingYear: 2024, type: 'set_on', amount: 500000 }],
    });

    expect(result.setOff).toBe(0);
    expect(result.payableBonus).toBe(result.minimumBonus);
  });

  it('ignores set-on that has aged out', () => {
    const result = allocate({
      allocableSurplus: 0,
      totalQualifyingWages: wages,
      accountingYear: 2026,
      ledger: [{ accountingYear: 2020, type: 'set_on', amount: 500000 }],
    });

    expect(result.drawnFromSetOn).toBe(0);
    expect(result.setOff).toBe(result.minimumBonus);
  });

  it('does not divide by zero when nobody is eligible', () => {
    const result = allocate({
      allocableSurplus: 100000,
      totalQualifyingWages: 0,
      accountingYear: 2026,
    });

    expect(result.bonusRate).toBe(0);
    expect(result.payableBonus).toBe(0);
  });
});

describe('applyToLedger', () => {
  it('spends set-on oldest first', () => {
    // Spending the newest first would let a live balance age out while an older
    // one sat unused.
    const ledger = [
      { accountingYear: 2025, type: 'set_on', amount: 100000 },
      { accountingYear: 2023, type: 'set_on', amount: 30000 },
    ];

    const next = applyToLedger(ledger, {
      accountingYear: 2026,
      drawnFromSetOn: 30000,
      setOn: 0,
      setOff: 0,
    });

    expect(next).toHaveLength(1);
    expect(next[0].accountingYear).toBe(2025);
    expect(next[0].amount).toBe(100000);
  });

  it('leaves a partial balance behind', () => {
    const next = applyToLedger(
      [{ accountingYear: 2024, type: 'set_on', amount: 50000 }],
      { accountingYear: 2026, drawnFromSetOn: 20000, setOn: 0, setOff: 0 },
    );

    expect(next[0].amount).toBe(30000);
  });

  it('records this year’s set on', () => {
    const next = applyToLedger([], {
      accountingYear: 2026,
      drawnFromSetOn: 0,
      setOn: 75000,
      setOff: 0,
    });

    expect(next).toEqual([
      { accountingYear: 2026, type: 'set_on', amount: 75000 },
    ]);
  });

  it('drops entries that expired this year', () => {
    const next = applyToLedger(
      [{ accountingYear: 2020, type: 'set_on', amount: 90000 }],
      { accountingYear: 2026, drawnFromSetOn: 0, setOn: 0, setOff: 0 },
    );

    expect(next).toEqual([]);
  });
});

describe('paymentDueDate', () => {
  it('is eight months after the close of the accounting year', () => {
    const due = paymentDueDate('2026-03-31');

    expect(due.getUTCFullYear()).toBe(2026);
    expect(due.getUTCMonth()).toBe(10); // November
  });

  it('clamps to the end of the month rather than rolling into the next one', () => {
    // 31 March + 8 months is "31 November", which JavaScript rolls forward to
    // 1 December — a deadline a day later than section 19 allows, for exactly
    // the 31 March year-end that most Indian establishments use.
    const due = paymentDueDate('2026-03-31');

    expect(due.getUTCDate()).toBe(30);
  });

  it('does not depend on the server timezone', () => {
    const due = paymentDueDate(new Date('2026-06-30T00:00:00.000Z'));

    expect(due.toISOString().slice(0, 10)).toBe('2027-02-28');
  });

  it('returns null for an unparseable date', () => {
    expect(paymentDueDate('nonsense')).toBeNull();
  });
});

describe('computeBonusRegister', () => {
  const roster = [
    ...Array.from({ length: 18 }, (unused, index) =>
      employee({ name: `Eligible ${index}`, employeeId: `e-${index}` }),
    ),
    employee({
      name: 'Too well paid',
      employeeId: 'x-1',
      monthlyWage: 45000,
      months: fullYear(45000),
    }),
    employee({
      name: 'Barely here',
      employeeId: 'x-2',
      months: [{ month: 1, daysWorked: 9, wage: 15000 }],
    }),
    employee({
      name: 'Dismissed',
      employeeId: 'x-3',
      disqualification: DISQUALIFICATION.FRAUD,
    }),
  ];

  const base = {
    employees: roster,
    accountingYear: 2026,
    accountingYearEnd: '2026-03-31',
    grossProfit: 6000000,
    depreciation: 500000,
    directTax: 1500000,
  };

  it('applies the Act at twenty-one employees', () => {
    expect(computeBonusRegister(base).applicable).toBe(true);
  });

  it('separates the register from the exclusions, with reasons', () => {
    const result = computeBonusRegister(base);

    expect(result.eligibleCount).toBe(18);
    expect(result.excludedCount).toBe(3);
    expect(result.excluded.map((row) => row.code).sort()).toEqual([
      EXCLUSION.DISQUALIFIED,
      EXCLUSION.INSUFFICIENT_DAYS,
      EXCLUSION.WAGE_CEILING,
    ]);
  });

  it('computes qualifying wages on the capped wage', () => {
    const result = computeBonusRegister(base);

    expect(result.totalQualifyingWages).toBe(18 * 12 * CALCULATION_WAGE_FLOOR);
  });

  it('adds up — the register total equals the payable bonus', () => {
    // An inspector reading Form C adds the column. It has to match, which is
    // why the rounding remainder is placed rather than dropped.
    const result = computeBonusRegister(base);

    const summed = result.register.reduce(
      (sum, row) => sum + row.bonusPayable,
      0,
    );

    expect(Math.round(summed * 100) / 100).toBeCloseTo(
      result.allocation.payableBonus,
      2,
    );
  });

  it('pays every eligible employee at the same establishment-level rate', () => {
    const result = computeBonusRegister(base);
    const rates = result.register
      .filter((row) => row.roundingAdjustment === undefined)
      .map((row) => row.bonusPayable / row.qualifyingWages);

    for (const rate of rates) {
      expect(rate).toBeCloseTo(result.allocation.bonusRate, 6);
    }
  });

  it('still owes the minimum bonus in a loss year', () => {
    const result = computeBonusRegister({
      ...base,
      grossProfit: 100000,
      directTax: 400000,
    });

    expect(result.allocation.payableBonus).toBe(result.allocation.minimumBonus);
    expect(result.allocation.setOff).toBeGreaterThan(0);
    expect(result.ledgerAfter.some((entry) => entry.type === 'set_off')).toBe(
      true,
    );
  });

  it('reports the section 19 payment deadline', () => {
    const result = computeBonusRegister(base);

    expect(result.paymentDueBy.getUTCMonth()).toBe(10);
    expect(result.paymentDueBy.getUTCDate()).toBe(30);
  });

  it('says the Act does not apply to a small establishment', () => {
    const result = computeBonusRegister({
      ...base,
      employees: roster.slice(0, 5),
    });

    expect(result.applicable).toBe(false);
    expect(result.coverage.reason).toMatch(/below the section 1\(3\)\(b\)/);
  });
});
