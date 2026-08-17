/**
 * Fixed Asset Register arithmetic (#1156).
 *
 * The property the whole register hangs on is the tie-out:
 *
 *     netBlock === grossBlock - accumulatedDepreciation - accumulatedImpairment
 *
 * on every category row and on the total. Most of what follows is that
 * invariant approached from a different direction — a disposal, an impairment,
 * a reversal — plus the reversal ceiling, which is the one place the accounting
 * rule is not obvious from the arithmetic.
 */

const {
  OVERDUE_AGEING_BANDS,
  resolveDepreciationPeriod,
  shouldDepreciateForPeriod,
  computeImpairment,
  buildFixedAssetRegister,
  detectOverdueReturns,
  bandForDaysOverdue,
  bandForAgeYears,
  summarizeAssetAgeing,
} = require('../assetRegister');

const IT = {
  _id: 'cat-it',
  name: 'IT Equipment',
  depreciationMethod: 'SLM',
  usefulLifeYears: 3,
};
const FURNITURE = {
  _id: 'cat-furn',
  name: 'Furniture',
  depreciationMethod: 'WDV',
  usefulLifeYears: 10,
};

/**
 * An asset as the controller would have written it.
 */
function asset({
  id = 'a1',
  categoryId = 'cat-it',
  purchasePrice = 100000,
  currentBookValue = 60000,
  purchaseDate = '2024-04-01',
  status = 'Available',
  accumulatedImpairment = 0,
  disposedAt = null,
  lastDepreciationPeriod = null,
} = {}) {
  return {
    _id: id,
    categoryId,
    purchasePrice,
    currentBookValue,
    purchaseDate,
    status,
    accumulatedImpairment,
    disposedAt,
    lastDepreciationPeriod,
  };
}

/**
 * An asset assignment. `expectedReturnDate` is the field the assignment schema
 * never declared, so every save dropped it.
 */
function assignment({
  id = 'as1',
  assetId = 'a1',
  employeeId = 'e1',
  isActive = true,
  checkoutDate = '2026-01-01',
  expectedReturnDate = null,
} = {}) {
  return {
    _id: id,
    assetId,
    employeeId,
    isActive,
    checkoutDate,
    expectedReturnDate,
  };
}

describe('resolveDepreciationPeriod', () => {
  it('formats a period as zero-padded YYYY-MM', () => {
    expect(resolveDepreciationPeriod(new Date('2026-03-15'))).toBe('2026-03');
    expect(resolveDepreciationPeriod(new Date('2026-11-01'))).toBe('2026-11');
  });

  it('falls back to now for an unparseable date', () => {
    expect(resolveDepreciationPeriod('not a date')).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('shouldDepreciateForPeriod', () => {
  it('charges an asset that has not been depreciated this period', () => {
    expect(shouldDepreciateForPeriod(asset(), '2026-03')).toBe(true);
  });

  it('does not charge the same period twice', () => {
    // runMonthlyDepreciation subtracted a month of depreciation on every call
    // with nothing recording which month it had just run, so a retried cron
    // depreciated twice and the register understated net block for the rest of
    // the asset's life.
    const depreciated = asset({ lastDepreciationPeriod: '2026-03' });

    expect(shouldDepreciateForPeriod(depreciated, '2026-03')).toBe(false);
    expect(shouldDepreciateForPeriod(depreciated, '2026-04')).toBe(true);
  });

  it.each(['Retired', 'Lost'])('does not charge a %s asset', (status) => {
    expect(shouldDepreciateForPeriod(asset({ status }), '2026-03')).toBe(false);
  });

  it('handles a missing asset', () => {
    expect(shouldDepreciateForPeriod(null, '2026-03')).toBe(false);
  });
});

describe('computeImpairment', () => {
  it('writes an asset down to its recoverable amount', () => {
    const result = computeImpairment(asset({ currentBookValue: 60000 }), 45000);

    expect(result.ok).toBe(true);
    expect(result.impairmentLoss).toBe(15000);
    expect(result.revisedCarryingValue).toBe(45000);
    expect(result.accumulatedImpairment).toBe(15000);
    expect(result.isImpaired).toBe(true);
  });

  it('reverses an impairment when the asset recovers', () => {
    const impaired = asset({
      currentBookValue: 45000,
      accumulatedImpairment: 15000,
    });

    const result = computeImpairment(impaired, 55000);

    expect(result.impairmentReversal).toBe(10000);
    expect(result.revisedCarryingValue).toBe(55000);
    expect(result.accumulatedImpairment).toBe(5000);
  });

  it('caps a reversal at what impairment previously took away', () => {
    // Without the ceiling an asset can be written down and back up repeatedly
    // until its carrying value exceeds what it cost.
    const impaired = asset({
      currentBookValue: 45000,
      accumulatedImpairment: 15000,
    });

    const result = computeImpairment(impaired, 90000);

    expect(result.impairmentReversal).toBe(15000);
    expect(result.revisedCarryingValue).toBe(60000);
    expect(result.accumulatedImpairment).toBe(0);
    expect(result.cappedByCeiling).toBe(true);
    expect(result.isImpaired).toBe(false);
  });

  it('does not reverse an asset that was never impaired', () => {
    const result = computeImpairment(
      asset({ currentBookValue: 60000, accumulatedImpairment: 0 }),
      80000,
    );

    expect(result.impairmentReversal).toBe(0);
    expect(result.revisedCarryingValue).toBe(60000);
    expect(result.cappedByCeiling).toBe(true);
  });

  it('is a no-op when the recoverable amount equals the carrying value', () => {
    const result = computeImpairment(asset({ currentBookValue: 60000 }), 60000);

    expect(result.impairmentLoss).toBe(0);
    expect(result.impairmentReversal).toBe(0);
    expect(result.revisedCarryingValue).toBe(60000);
  });

  it('writes an asset down to zero', () => {
    const result = computeImpairment(asset({ currentBookValue: 60000 }), 0);

    expect(result.impairmentLoss).toBe(60000);
    expect(result.revisedCarryingValue).toBe(0);
  });

  it('rejects a negative recoverable amount', () => {
    const result = computeImpairment(asset(), -1);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('positive');
  });

  it.each(['Retired', 'Lost'])('refuses to impair a %s asset', (status) => {
    const result = computeImpairment(asset({ status }), 100);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain(status);
  });
});

describe('buildFixedAssetRegister', () => {
  it('ties out: net block equals gross less depreciation less impairment', () => {
    const register = buildFixedAssetRegister(
      [
        asset({ id: 'a1', purchasePrice: 100000, currentBookValue: 60000 }),
        asset({
          id: 'a2',
          purchasePrice: 50000,
          currentBookValue: 30000,
          accumulatedImpairment: 5000,
        }),
      ],
      [IT],
    );

    expect(register.isBalanced).toBe(true);
    expect(register.totals.netBlock).toBe(90000);
    expect(register.totals.grossBlock).toBe(150000);
    expect(register.totals.accumulatedImpairment).toBe(5000);
    // 100000-60000 = 40000, plus 50000-30000-5000 = 15000.
    expect(register.totals.accumulatedDepreciation).toBe(55000);
    expect(register.derivedNetBlock).toBe(register.totals.netBlock);
  });

  it('ties out on every category row, not just the total', () => {
    const register = buildFixedAssetRegister(
      [
        asset({
          id: 'a1',
          categoryId: 'cat-it',
          purchasePrice: 100000,
          currentBookValue: 60000,
        }),
        asset({
          id: 'a2',
          categoryId: 'cat-furn',
          purchasePrice: 80000,
          currentBookValue: 20000,
          accumulatedImpairment: 10000,
        }),
      ],
      [IT, FURNITURE],
    );

    for (const row of register.categories) {
      expect(
        row.grossBlock -
          row.accumulatedDepreciation -
          row.accumulatedImpairment,
      ).toBeCloseTo(row.netBlock, 2);
    }
  });

  it('groups by category and names each row', () => {
    const register = buildFixedAssetRegister(
      [
        asset({ id: 'a1', categoryId: 'cat-it' }),
        asset({ id: 'a2', categoryId: 'cat-it' }),
        asset({ id: 'a3', categoryId: 'cat-furn' }),
      ],
      [IT, FURNITURE],
    );

    expect(register.categories).toHaveLength(2);
    // Sorted by name, so Furniture leads.
    expect(register.categories[0].categoryName).toBe('Furniture');
    expect(register.categories[1].assetCount).toBe(2);
  });

  it('treats a populated category document and a raw id as one category', () => {
    // Unpopulated the field is an ObjectId, populated it is a document.
    // Grouping the raw value puts one category in two rows of the register.
    const register = buildFixedAssetRegister(
      [
        asset({ id: 'a1', categoryId: IT }),
        asset({ id: 'a2', categoryId: 'cat-it' }),
      ],
      [IT],
    );

    expect(register.categories).toHaveLength(1);
    expect(register.categories[0].categoryName).toBe('IT Equipment');
  });

  it('takes a disposed asset out of gross and net block', () => {
    // Leaving it in has the register reporting assets the company no longer
    // owns.
    const register = buildFixedAssetRegister(
      [
        asset({ id: 'a1', purchasePrice: 100000, currentBookValue: 60000 }),
        asset({
          id: 'a2',
          purchasePrice: 50000,
          currentBookValue: 0,
          status: 'Retired',
          disposedAt: '2026-05-01',
        }),
      ],
      [IT],
    );

    expect(register.totals.grossBlock).toBe(100000);
    expect(register.totals.assetCount).toBe(1);
    expect(register.totals.disposedCount).toBe(1);
    expect(register.isBalanced).toBe(true);
  });

  it('counts additions and disposals as movements inside the period', () => {
    // Movements within the period, against positions at the end of it. Mixing
    // the two is the usual way a register fails to tie out.
    const register = buildFixedAssetRegister(
      [
        asset({ id: 'old', purchaseDate: '2023-01-01' }),
        asset({
          id: 'new',
          purchaseDate: '2026-06-15',
          purchasePrice: 20000,
          currentBookValue: 20000,
        }),
        asset({
          id: 'gone',
          purchasePrice: 30000,
          status: 'Retired',
          disposedAt: '2026-07-01',
        }),
        asset({
          id: 'gone-earlier',
          purchasePrice: 40000,
          status: 'Retired',
          disposedAt: '2020-01-01',
        }),
      ],
      [IT],
      { startDate: '2026-04-01', endDate: '2027-03-31' },
    );

    expect(register.totals.additions).toBe(20000);
    expect(register.totals.disposals).toBe(30000);
  });

  it('includes everything when no period bounds are given', () => {
    const register = buildFixedAssetRegister(
      [asset({ id: 'a1', purchaseDate: '2019-01-01' })],
      [IT],
    );

    expect(register.totals.additions).toBe(100000);
    expect(register.period.startDate).toBeNull();
  });

  it('never reports negative accumulated depreciation', () => {
    // A book value above cost is a data error somewhere upstream; it must not
    // come out of the register as a negative charge that offsets real ones.
    const register = buildFixedAssetRegister(
      [asset({ purchasePrice: 50000, currentBookValue: 90000 })],
      [IT],
    );

    expect(register.totals.accumulatedDepreciation).toBe(0);
  });

  it('labels assets with no category rather than emitting an undefined row', () => {
    const register = buildFixedAssetRegister([asset({ categoryId: null })], []);

    expect(register.categories[0].categoryName).toBe('Uncategorised');
    expect(register.categories[0].categoryId).toBeNull();
  });

  it('handles an empty register', () => {
    const register = buildFixedAssetRegister([], []);

    expect(register.categories).toHaveLength(0);
    expect(register.totals.netBlock).toBe(0);
    expect(register.isBalanced).toBe(true);
  });
});

describe('detectOverdueReturns', () => {
  const asOf = new Date('2026-08-17');

  it('lists an active assignment past its expected return date', () => {
    const result = detectOverdueReturns(
      [assignment({ expectedReturnDate: '2026-08-01' })],
      asOf,
    );

    expect(result.overdueCount).toBe(1);
    expect(result.overdue[0].daysOverdue).toBe(16);
    expect(result.overdue[0].ageingBand).toBe('8-30 days');
  });

  it('does not flag an assignment that is not yet due', () => {
    const result = detectOverdueReturns(
      [assignment({ expectedReturnDate: '2026-09-01' })],
      asOf,
    );

    expect(result.overdueCount).toBe(0);
    expect(result.activeCount).toBe(1);
  });

  it('ignores a returned assignment', () => {
    const result = detectOverdueReturns(
      [assignment({ isActive: false, expectedReturnDate: '2020-01-01' })],
      asOf,
    );

    expect(result.overdueCount).toBe(0);
    expect(result.activeCount).toBe(0);
  });

  it('counts an open-ended assignment separately rather than as overdue', () => {
    // No expected return date means indefinite custody, which is a policy
    // question — not a late return.
    const result = detectOverdueReturns(
      [assignment({ expectedReturnDate: null })],
      asOf,
    );

    expect(result.overdueCount).toBe(0);
    expect(result.openEndedCount).toBe(1);
  });

  it('sorts the most overdue first', () => {
    const result = detectOverdueReturns(
      [
        assignment({ id: 'recent', expectedReturnDate: '2026-08-10' }),
        assignment({ id: 'ancient', expectedReturnDate: '2025-01-01' }),
      ],
      asOf,
    );

    expect(result.overdue[0].assignmentId).toBe('ancient');
  });

  it('buckets every overdue assignment into exactly one band', () => {
    const result = detectOverdueReturns(
      [
        assignment({ id: 'd3', expectedReturnDate: '2026-08-14' }),
        assignment({ id: 'd20', expectedReturnDate: '2026-07-28' }),
        assignment({ id: 'd60', expectedReturnDate: '2026-06-18' }),
        assignment({ id: 'd400', expectedReturnDate: '2025-07-14' }),
      ],
      asOf,
    );

    const banded = result.byBand.reduce((sum, band) => sum + band.count, 0);

    expect(banded).toBe(result.overdueCount);
    expect(result.byBand).toHaveLength(OVERDUE_AGEING_BANDS.length);
  });

  it('handles no assignments', () => {
    expect(detectOverdueReturns([], asOf).overdueCount).toBe(0);
  });
});

describe('band helpers', () => {
  it.each([
    [1, '1-7 days'],
    [7, '1-7 days'],
    [8, '8-30 days'],
    [30, '8-30 days'],
    [31, '31-90 days'],
    [400, '90+ days'],
  ])('maps %i days overdue to %s', (days, expected) => {
    expect(bandForDaysOverdue(days)).toBe(expected);
  });

  it.each([
    [0.5, '0-1 years'],
    [2, '1-3 years'],
    [4, '3-5 years'],
    [12, '5+ years'],
    [Infinity, '5+ years'],
  ])('maps an age of %s years to %s', (years, expected) => {
    expect(bandForAgeYears(years)).toBe(expected);
  });
});

describe('summarizeAssetAgeing', () => {
  const asOf = new Date('2026-08-17');

  it('buckets assets by age and reports each band’s share of net block', () => {
    const summary = summarizeAssetAgeing(
      [
        asset({
          id: 'fresh',
          purchaseDate: '2026-06-01',
          currentBookValue: 75000,
        }),
        asset({
          id: 'old',
          purchaseDate: '2019-01-01',
          currentBookValue: 25000,
        }),
      ],
      asOf,
    );

    const fresh = summary.bands.find((b) => b.band === '0-1 years');
    const old = summary.bands.find((b) => b.band === '5+ years');

    expect(fresh.count).toBe(1);
    expect(fresh.netBlockPercent).toBe(75);
    expect(old.netBlockPercent).toBe(25);
    expect(summary.totalNetBlock).toBe(100000);
  });

  it('excludes disposed assets', () => {
    const summary = summarizeAssetAgeing(
      [asset({ status: 'Retired', currentBookValue: 10000 })],
      asOf,
    );

    expect(summary.assetCount).toBe(0);
    expect(summary.totalNetBlock).toBe(0);
  });

  it('puts an asset with no purchase date in the oldest band', () => {
    // Treating a missing date as an age of zero would report a broken row as a
    // brand-new asset, where nobody would look at it.
    const summary = summarizeAssetAgeing([asset({ purchaseDate: null })], asOf);

    expect(summary.bands.find((b) => b.band === '5+ years').count).toBe(1);
  });

  it('does not divide by zero on an empty register', () => {
    const summary = summarizeAssetAgeing([], asOf);

    expect(summary.totalNetBlock).toBe(0);
    expect(summary.bands.every((b) => b.netBlockPercent === 0)).toBe(true);
  });
});
