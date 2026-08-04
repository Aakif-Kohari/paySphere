const mongoose = require('mongoose');
const TaxBracket = require('../../models/taxBracket.model');
const TaxService = require('../tax.service');

jest.mock('../../models/taxBracket.model');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

const logger = require('../../utils/logger');

const TENANT = new mongoose.Types.ObjectId().toString();

const slabs = () => [
  { minIncome: 0, maxIncome: 250000, ratePercentage: 0 },
  { minIncome: 250000, maxIncome: 500000, ratePercentage: 5 },
  { minIncome: 500000, maxIncome: 1000000, ratePercentage: 20 },
  { minIncome: 1000000, maxIncome: null, ratePercentage: 30 },
];

const config = (overrides = {}) => ({
  region: 'IN',
  currency: 'INR',
  brackets: slabs(),
  socialSecurityRate: 0,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  TaxBracket.findOne.mockResolvedValue(config());
});

describe('calculateTax — the numbers (#616)', () => {
  test('charges the correct progressive tax', async () => {
    const result = await TaxService.calculateTax(TENANT, 'IN', 1200000);

    expect(result.totalTax).toBe(172500);
  });

  test('adds social security on the full gross', async () => {
    TaxBracket.findOne.mockResolvedValue(config({ socialSecurityRate: 12 }));

    const result = await TaxService.calculateTax(TENANT, 'IN', 1000000);

    expect(result.socialSecurity).toBe(120000);
  });

  test('reports the effective rate including contributions', async () => {
    const result = await TaxService.calculateTax(TENANT, 'IN', 1200000);

    expect(result.effectiveRate).toBe(14.38);
  });

  test('returns the slab breakdown the caller can show on a payslip', async () => {
    const result = await TaxService.calculateTax(TENANT, 'IN', 300000);

    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown.at(-1).tax).toBe(2500);
  });

  test("reports the table's currency", async () => {
    const result = await TaxService.calculateTax(TENANT, 'IN', 300000);

    expect(result.currency).toBe('INR');
  });
});

describe('calculateTax — degenerate income (#616)', () => {
  test.each([
    ['zero', 0],
    ['negative', -100000],
    ['NaN', NaN],
    ['a non-number', 'lots'],
    ['undefined', undefined],
  ])('%s income gives zeros, never NaN', async (_label, gross) => {
    const result = await TaxService.calculateTax(TENANT, 'IN', gross);

    expect(result.totalTax).toBe(0);
    expect(result.socialSecurity).toBe(0);
    // `#586` computed `(0 + 0) / 0` = NaN, which JSON.stringify renders as
    // `null` — the caller sees a missing field rather than a failed sum.
    expect(result.effectiveRate).toBe(0);
    expect(Number.isNaN(result.effectiveRate)).toBe(false);
  });

  test('a zero income does not even reach the database', async () => {
    await TaxService.calculateTax(TENANT, 'IN', 0);

    expect(TaxBracket.findOne).not.toHaveBeenCalled();
  });

  test('the response survives JSON serialisation with real numbers', async () => {
    const result = await TaxService.calculateTax(TENANT, 'IN', 0);
    const payload = JSON.parse(JSON.stringify(result));

    expect(payload.effectiveRate).toBe(0);
    expect(payload.effectiveRate).not.toBeNull();
  });
});

describe('calculateTax — scoping (#616)', () => {
  test('scopes the lookup to the company and the region', async () => {
    await TaxService.calculateTax(TENANT, 'IN', 500000);

    expect(TaxBracket.findOne).toHaveBeenCalledWith({ tenantId: TENANT, region: 'IN' });
  });

  test('refuses to look anything up without a tenant', async () => {
    const result = await TaxService.calculateTax(undefined, 'IN', 500000);

    // `findOne({ tenantId: undefined, region })` reaches the server as
    // `findOne({ region })` — another company's table (#612).
    expect(TaxBracket.findOne).not.toHaveBeenCalled();
    expect(result.totalTax).toBe(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('refuses a tenant that is not an id', async () => {
    await TaxService.calculateTax('not-an-id', 'IN', 500000);

    expect(TaxBracket.findOne).not.toHaveBeenCalled();
  });
});

describe('calculateTax — no table configured (#616)', () => {
  test('charges nothing', async () => {
    TaxBracket.findOne.mockResolvedValue(null);

    const result = await TaxService.calculateTax(TENANT, 'XX', 1200000);

    expect(result.totalTax).toBe(0);
  });

  test('says so, so the caller can tell it apart from "nothing is owed"', async () => {
    TaxBracket.findOne.mockResolvedValue(null);

    const result = await TaxService.calculateTax(TENANT, 'XX', 1200000);

    // `#586` returned bare zeros for both cases, so "no tax due" and "nobody
    // has set this region up" were indistinguishable.
    expect(result.configured).toBe(false);
  });

  test('a configured region reports configured: true', async () => {
    const result = await TaxService.calculateTax(TENANT, 'IN', 1200000);

    expect(result.configured).toBe(true);
  });
});

describe('calculateTax — an unusable table (#616)', () => {
  const broken = () =>
    config({
      brackets: [
        { minIncome: 0, maxIncome: 250000, ratePercentage: 0 },
        // Gap: nothing covers 250,000–300,000.
        { minIncome: 300000, maxIncome: null, ratePercentage: 30 },
      ],
    });

  test('charges nothing rather than a number derived from a table that does not add up', async () => {
    TaxBracket.findOne.mockResolvedValue(broken());

    const result = await TaxService.calculateTax(TENANT, 'IN', 1200000);

    expect(result.totalTax).toBe(0);
  });

  test('raises the alarm with the specific problems', async () => {
    TaxBracket.findOne.mockResolvedValue(broken());

    const result = await TaxService.calculateTax(TENANT, 'IN', 1200000);

    expect(result.errors.join(' ')).toMatch(/gap/);
    expect(logger.error).toHaveBeenCalledWith(
      'Tax table is not usable',
      expect.objectContaining({ region: 'IN' }),
    );
  });

  test('still reports the region as configured — it exists, it is just wrong', async () => {
    TaxBracket.findOne.mockResolvedValue(broken());

    const result = await TaxService.calculateTax(TENANT, 'IN', 1200000);

    expect(result.configured).toBe(true);
  });

  test('catches a table written by an update that skipped validators', async () => {
    // updateMany skips validators by default, so the schema-level check cannot
    // be the only one. This is the second line of defence.
    TaxBracket.findOne.mockResolvedValue(
      config({ brackets: [{ minIncome: 0, maxIncome: 100, ratePercentage: 900 }] }),
    );

    const result = await TaxService.calculateTax(TENANT, 'IN', 1200000);

    expect(result.totalTax).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
