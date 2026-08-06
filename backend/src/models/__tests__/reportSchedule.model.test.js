const mongoose = require('mongoose');
const ReportSchedule = require('../reportSchedule.model');
const {
  REPORT_TYPES,
  FREQUENCIES,
  MAX_RECIPIENTS,
} = require('../reportSchedule.model');

const TENANT_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

const buildSchedule = (overrides = {}) =>
  new ReportSchedule({
    reportType: 'payroll',
    frequency: 'monthly',
    recipients: ['hr@acme.com'],
    createdBy: USER_ID,
    tenantId: TENANT_ID,
    ...overrides,
  });

/** The first validation message for a path, or undefined. */
const errorFor = (doc, path) => doc.validateSync()?.errors?.[path]?.message;

describe('reportSchedule — the double-escaped recipient regex (#666)', () => {
  test('the old pattern matched no real address', () => {
    // /^\\S+@\\S+\\.\\S+$/ — inside a regex literal `\\S` is an escaped
    // backslash followed by the letter S, not the non-whitespace class. So the
    // pattern reads "a backslash, some Ss, an @, a backslash, some Ss, ..." and
    // no email address on earth matches it. Every save threw, and
    // POST /api/schedules never once succeeded.
    const broken = /^\\S+@\\S+\\.\\S+$/;

    expect(broken.test('hr@acme.com')).toBe(false);
    expect(broken.test('finance.team@acme.co.in')).toBe(false);
    expect(broken.test('a@b.co')).toBe(false);

    // The only shape it does accept, which is not an address:
    expect(broken.test('\\S@\\S\\.\\S')).toBe(true);
  });

  test('the model source no longer carries it', () => {
    const source = require('fs').readFileSync(
      require.resolve('../reportSchedule.model'),
      'utf8',
    );
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(code).not.toMatch(/\\\\S\+@/);
  });

  test('a real address validates', () => {
    expect(buildSchedule().validateSync()).toBeUndefined();
  });

  test.each([
    ['hr@acme.com'],
    ['finance.team@acme.co.in'],
    ['payroll+reports@acme.io'],
    ['a@b.co'],
  ])('accepts %s', (email) => {
    expect(buildSchedule({ recipients: [email] }).validateSync()).toBeUndefined();
  });
});

describe('reportSchedule — recipient validation (#666)', () => {
  test('rejects an empty list', () => {
    expect(errorFor(buildSchedule({ recipients: [] }), 'recipients')).toMatch(
      /at least one recipient/i,
    );
  });

  test('rejects an address that is not one', () => {
    const message = errorFor(
      buildSchedule({ recipients: ['hr@acme.com', 'not-an-email'] }),
      'recipients',
    );

    expect(message).toMatch(/Invalid recipient/);
    // The message names the offender rather than saying "check your input".
    expect(message).toContain('not-an-email');
  });

  test('caps the list length', () => {
    const many = Array.from(
      { length: MAX_RECIPIENTS + 1 },
      (_, i) => `person${i}@acme.com`,
    );

    expect(errorFor(buildSchedule({ recipients: many }), 'recipients')).toMatch(
      /more than/i,
    );
  });

  test('accepts exactly the cap', () => {
    const atCap = Array.from(
      { length: MAX_RECIPIENTS },
      (_, i) => `person${i}@acme.com`,
    );

    expect(buildSchedule({ recipients: atCap }).validateSync()).toBeUndefined();
  });
});

describe('reportSchedule — the rest of the schema (#666)', () => {
  test('the vocabularies are exported for the controller to reuse', () => {
    expect(REPORT_TYPES).toEqual(['analytics', 'payroll', 'turnover', 'custom']);
    expect(FREQUENCIES).toEqual(['daily', 'weekly', 'monthly']);
  });

  test('rejects an unknown reportType', () => {
    expect(
      errorFor(buildSchedule({ reportType: 'quarterly-magic' }), 'reportType'),
    ).toBeDefined();
  });

  test('rejects an unknown frequency', () => {
    expect(
      errorFor(buildSchedule({ frequency: 'hourly' }), 'frequency'),
    ).toBeDefined();
  });

  test('still requires both createdBy and tenantId', () => {
    // #613: the codemod dropped createdBy while the schema still demanded it.
    expect(
      errorFor(buildSchedule({ createdBy: undefined }), 'createdBy'),
    ).toBeDefined();
    expect(
      errorFor(buildSchedule({ tenantId: undefined }), 'tenantId'),
    ).toBeDefined();
  });

  test('indexes the paths the cron and the list endpoint actually query', () => {
    const keys = ReportSchedule.schema.indexes().map(([key]) => key);

    expect(keys).toContainEqual({ tenantId: 1, createdAt: -1 });
    expect(keys).toContainEqual({ isActive: 1, frequency: 1 });
  });
});
