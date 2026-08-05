const mongoose = require('mongoose');
const TaxBracket = require('../taxBracket.model');

/**
 * Schema-level guards for #616.
 *
 * `#586` accepted a rate of -5 or 900, a slab whose floor sat above its
 * ceiling, and an empty table. None of those produce an error at calculation
 * time — they produce a wrong deduction, which is the worst failure mode there
 * is for payroll.
 */
const validTable = (overrides = {}) => ({
  region: 'IN',
  currency: 'INR',
  tenantId: new mongoose.Types.ObjectId(),
  brackets: [
    { minIncome: 0, maxIncome: 250000, ratePercentage: 0 },
    { minIncome: 250000, maxIncome: 500000, ratePercentage: 5 },
    { minIncome: 500000, maxIncome: null, ratePercentage: 20 },
  ],
  ...overrides,
});

const errorsFor = (doc) => new TaxBracket(doc).validateSync()?.errors || {};

describe('TaxBracket — a well-formed table (#616)', () => {
  test('validates', () => {
    expect(new TaxBracket(validTable()).validateSync()).toBeUndefined();
  });

  test('requires a tenant', () => {
    const doc = validTable();
    delete doc.tenantId;

    // `findOne({ tenantId: undefined, region })` returns another company's
    // table, because the driver drops the undefined key (#612).
    expect(errorsFor(doc).tenantId).toBeDefined();
  });
});

describe('TaxBracket — per-slab guards (#616)', () => {
  test('rejects a negative rate', () => {
    const doc = validTable();
    doc.brackets[1].ratePercentage = -5;

    expect(Object.keys(errorsFor(doc)).length).toBeGreaterThan(0);
  });

  test('rejects a rate above 100', () => {
    const doc = validTable();
    doc.brackets[1].ratePercentage = 900;

    expect(Object.keys(errorsFor(doc)).length).toBeGreaterThan(0);
  });

  test('rejects a negative floor', () => {
    const doc = validTable();
    doc.brackets[0].minIncome = -1;

    expect(Object.keys(errorsFor(doc)).length).toBeGreaterThan(0);
  });

  test('rejects a negative fixed component', () => {
    const doc = validTable();
    doc.brackets[1].fixedDeduction = -100;

    expect(Object.keys(errorsFor(doc)).length).toBeGreaterThan(0);
  });

  test('rejects a social security rate outside 0–100', () => {
    expect(errorsFor(validTable({ socialSecurityRate: -1 })).socialSecurityRate)
      .toBeDefined();
    expect(errorsFor(validTable({ socialSecurityRate: 101 })).socialSecurityRate)
      .toBeDefined();
  });

  test('an absent ceiling defaults to null, meaning open-ended', () => {
    const doc = new TaxBracket(validTable());

    expect(doc.brackets[2].maxIncome).toBeNull();
  });
});

describe('TaxBracket — whole-table structure (#616)', () => {
  test('rejects an empty table', () => {
    expect(errorsFor(validTable({ brackets: [] })).brackets).toBeDefined();
  });

  test('rejects a gap between slabs', () => {
    const doc = validTable();
    doc.brackets[2].minIncome = 600000;

    expect(errorsFor(doc).brackets.message).toMatch(/gap/);
  });

  test('rejects overlapping slabs', () => {
    const doc = validTable();
    doc.brackets[2].minIncome = 400000;

    expect(errorsFor(doc).brackets.message).toMatch(/overlap/);
  });

  test('rejects a ceiling below its own floor', () => {
    const doc = validTable();
    doc.brackets[1].maxIncome = 100000;

    expect(Object.keys(errorsFor(doc)).length).toBeGreaterThan(0);
  });

  test('rejects a bounded top slab — income above it would be untaxed', () => {
    const doc = validTable();
    doc.brackets[2].maxIncome = 1000000;

    expect(errorsFor(doc).brackets.message).toMatch(/highest slab must be open-ended/);
  });

  test('rejects an open-ended slab that is not the highest', () => {
    const doc = validTable();
    doc.brackets[1].maxIncome = null;

    expect(errorsFor(doc).brackets.message).toMatch(/not the highest/);
  });

  test('accepts a table stored out of order — order is not the contract', () => {
    const table = validTable();
    const doc = validTable({
      brackets: [table.brackets[2], table.brackets[0], table.brackets[1]],
    });

    expect(new TaxBracket(doc).validateSync()).toBeUndefined();
  });

  test('the message names every problem, not just the first', () => {
    const doc = validTable();
    doc.brackets[1].ratePercentage = 900;
    doc.brackets[2].minIncome = 600000;

    const message = errorsFor(doc).brackets?.message || '';
    expect(message).toMatch(/gap/);
  });
});

describe('TaxBracket — one table per region per company (#616)', () => {
  test('declares a unique index on tenantId + region', () => {
    const index = TaxBracket.schema
      .indexes()
      .find(([fields]) => 'tenantId' in fields && 'region' in fields);

    expect(index).toBeDefined();
    // Without this, two configurations for the same region coexist and
    // `findOne` returns whichever the storage engine reaches first — so the tax
    // an employee pays depends on insertion order.
    expect(index[1].unique).toBe(true);
  });
});
