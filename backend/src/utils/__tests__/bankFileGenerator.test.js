/**
 * Bank payment file generation and return reconciliation (#1075).
 *
 * This is the code that causes irreversible transfers, so the suite leans hard
 * on the cases where a plausible implementation is quietly wrong:
 *
 *   - amounts carried as integer paise, so no total is ever a paisa out;
 *   - payment mode resolved by rule and never taken from input;
 *   - fixed-width records that are *exactly* the specified width, since a
 *     parser at the other end reads by offset;
 *   - control totals that detect a body edited after generation;
 *   - a return file for the wrong batch not being applied.
 */

'use strict';

/**
 * Records of a generated file, split without trimming.
 *
 * `content.trim()` would eat the trailer's trailing filler — 60 spaces that the
 * format requires — and report a 40-character record. Only the final newline is
 * removed.
 *
 * @param {string} content
 * @returns {string[]}
 */
const recordsOf = (content) => String(content).replace(/\n$/, '').split('\n');

const {
  RTGS_FLOOR_RUPEES,
  NACH_RECORD_LENGTH,
  PAYMENT_MODES,
  LINE_STATUS,
  toPaise,
  toRupees,
  formatDate,
  fixedWidth,
  escapeField,
  validateIfsc,
  validateAccountNumber,
  maskAccountNumber,
  resolvePaymentMode,
  validateBatch,
  computeControlTotals,
  verifyControlTotals,
  generateDelimitedFile,
  generateNachFile,
  parseReturnFile,
  reconcileReturns,
} = require('../bankFileGenerator');

const DEBIT_IFSC = 'HDFC0001234';

const line = (overrides = {}) => ({
  employeeId: 'e1',
  beneficiaryName: 'Asha Rao',
  accountNumber: '123456789012',
  ifsc: 'ICIC0000123',
  amount: 50000,
  ...overrides,
});

const batch = (overrides = {}) => ({
  batchReference: 'SAL202608',
  valueDate: '2026-08-31T00:00:00.000Z',
  debitAccountNumber: '000111222333',
  debitIfsc: DEBIT_IFSC,
  ...overrides,
});

describe('toPaise / toRupees', () => {
  it('converts rupees to integer paise', () => {
    expect(toPaise(12345.67)).toBe(1234567);
    expect(Number.isInteger(toPaise(0.1 + 0.2))).toBe(true);
  });

  it('rounds the half-paisa case deterministically', () => {
    // Math.round(12345.675 * 100) lands either side depending on the binary
    // representation. A payment file is not a place for a value that depends on
    // how it was computed.
    expect(toPaise(12345.675)).toBe(1234568);
  });

  it('returns 0 rather than NaN for an unusable value', () => {
    expect(toPaise(undefined)).toBe(0);
    expect(toPaise('abc')).toBe(0);
  });

  it('round-trips back to rupees', () => {
    expect(toRupees(toPaise(99999.99))).toBe(99999.99);
  });
});

describe('formatDate', () => {
  it('renders YYYYMMDD in UTC', () => {
    // UTC deliberately: a local-zone value date shifts by a day for deployments
    // east or west of wherever it was tested, and a salary file dated a day
    // late is a salary paid a day late.
    expect(formatDate('2026-08-31T23:30:00.000Z')).toBe('20260831');
  });

  it('returns a sentinel rather than NaN text for an unusable date', () => {
    expect(formatDate('not-a-date')).toBe('00000000');
  });
});

describe('fixedWidth and escapeField', () => {
  it('pads left-aligned by default', () => {
    expect(fixedWidth('AB', 5)).toBe('AB   ');
  });

  it('zero-pads right-aligned numerics', () => {
    expect(fixedWidth(42, 6, 'right', '0')).toBe('000042');
  });

  it('truncates rather than overflowing the field', () => {
    expect(fixedWidth('ABCDEFGH', 4)).toBe('ABCD');
  });

  it('quotes a field containing the delimiter', () => {
    // "Rao, Asha" as it appears on the account would otherwise shift every
    // later column by one, and the bank would read the IFSC as the amount.
    expect(escapeField('Rao, Asha', ',')).toBe('"Rao, Asha"');
  });

  it('doubles an embedded quote', () => {
    expect(escapeField('A "B" C', ',')).toBe('"A ""B"" C"');
  });

  it('leaves an ordinary field alone', () => {
    expect(escapeField('Asha Rao', ',')).toBe('Asha Rao');
  });
});

describe('validateIfsc', () => {
  it('accepts a well-formed IFSC', () => {
    const result = validateIfsc('ICIC0000123');

    expect(result.valid).toBe(true);
    expect(result.bankCode).toBe('ICIC');
    expect(result.branchCode).toBe('000123');
  });

  it('uppercases and trims before checking', () => {
    expect(validateIfsc('  icic0000123 ').valid).toBe(true);
  });

  it('rejects a code without the reserved zero in position five', () => {
    // The cheapest way to catch a field that has been filled with something
    // else entirely.
    expect(validateIfsc('ICIC1000123').valid).toBe(false);
  });

  it('rejects the wrong length, and says what it got', () => {
    const result = validateIfsc('ICIC000012');

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('got 10');
  });

  it('rejects letters in the bank code position', () => {
    expect(validateIfsc('1CIC0000123').valid).toBe(false);
  });

  it('rejects a missing value', () => {
    expect(validateIfsc(undefined).reason).toBe('IFSC is missing');
  });
});

describe('validateAccountNumber', () => {
  it('accepts a 12-digit account', () => {
    expect(validateAccountNumber('123456789012').valid).toBe(true);
  });

  it('keeps leading zeros', () => {
    // `Number('0012345678')` silently discards them, and the leading zero is
    // part of the account. This is why the model stores it as a string.
    const result = validateAccountNumber('0012345678');

    expect(result.valid).toBe(true);
    expect(result.accountNumber).toBe('0012345678');
  });

  it('rejects an account that is too short or too long', () => {
    expect(validateAccountNumber('12345678').valid).toBe(false);
    expect(validateAccountNumber('1234567890123456789').valid).toBe(false);
  });

  it('rejects non-digits', () => {
    expect(validateAccountNumber('12345678A012').valid).toBe(false);
  });
});

describe('maskAccountNumber', () => {
  it('leaves the last four digits visible', () => {
    expect(maskAccountNumber('123456789012')).toBe('XXXXXXXX9012');
  });

  it('masks a short value entirely rather than exposing all of it', () => {
    expect(maskAccountNumber('1234')).toBe('XXXX');
  });

  it('returns an empty string for a missing value', () => {
    expect(maskAccountNumber(null)).toBe('');
  });
});

describe('resolvePaymentMode', () => {
  it('routes a same-bank credit internally', () => {
    // Sending it over NEFT would pay an interbank rail to move money between
    // two accounts at the same bank, and settle in batches instead of
    // instantly.
    const result = resolvePaymentMode({
      amount: 50000,
      beneficiaryIfsc: 'HDFC0009999',
      debitIfsc: DEBIT_IFSC,
    });

    expect(result.mode).toBe(PAYMENT_MODES.INTERNAL);
    expect(result.reason).toContain('Same bank');
  });

  it('routes an interbank credit at the RTGS floor to RTGS', () => {
    // Inclusive: the floor is "at and above", and an off-by-one here sends a
    // ₹2,00,000 credit over the wrong rail.
    expect(
      resolvePaymentMode({
        amount: RTGS_FLOOR_RUPEES,
        beneficiaryIfsc: 'ICIC0000123',
        debitIfsc: DEBIT_IFSC,
      }).mode,
    ).toBe(PAYMENT_MODES.RTGS);
  });

  it('routes one rupee below the floor to NEFT', () => {
    expect(
      resolvePaymentMode({
        amount: RTGS_FLOOR_RUPEES - 1,
        beneficiaryIfsc: 'ICIC0000123',
        debitIfsc: DEBIT_IFSC,
      }).mode,
    ).toBe(PAYMENT_MODES.NEFT);
  });

  it('prefers internal over RTGS for a large same-bank credit', () => {
    // Rule order matters: a ₹5,00,000 credit to an account at the same bank is
    // still a book transfer.
    expect(
      resolvePaymentMode({
        amount: 500000,
        beneficiaryIfsc: 'HDFC0009999',
        debitIfsc: DEBIT_IFSC,
      }).mode,
    ).toBe(PAYMENT_MODES.INTERNAL);
  });

  it('uses IMPS only when asked and within the ceiling', () => {
    expect(
      resolvePaymentMode({
        amount: 50000,
        beneficiaryIfsc: 'ICIC0000123',
        debitIfsc: DEBIT_IFSC,
        preferImps: true,
      }).mode,
    ).toBe(PAYMENT_MODES.IMPS);
  });

  it('refuses to resolve a mode for an invalid beneficiary IFSC', () => {
    const result = resolvePaymentMode({
      amount: 1000,
      beneficiaryIfsc: 'BAD',
      debitIfsc: DEBIT_IFSC,
    });

    expect(result.mode).toBeNull();
    expect(result.reason).toContain('Beneficiary IFSC invalid');
  });

  it('refuses a non-positive amount', () => {
    expect(
      resolvePaymentMode({
        amount: 0,
        beneficiaryIfsc: 'ICIC0000123',
        debitIfsc: DEBIT_IFSC,
      }).mode,
    ).toBeNull();
  });

  it('falls back to interbank routing when the debit IFSC is unusable', () => {
    // A missing debit IFSC must not be read as "same bank" and route everything
    // internally.
    expect(
      resolvePaymentMode({
        amount: 50000,
        beneficiaryIfsc: 'ICIC0000123',
        debitIfsc: '',
      }).mode,
    ).toBe(PAYMENT_MODES.NEFT);
  });
});

describe('validateBatch', () => {
  it('partitions rather than throwing', () => {
    // One bad beneficiary in four hundred must not sink the run, and must not
    // be silently dropped either.
    const result = validateBatch(
      [
        line(),
        line({ ifsc: 'BAD', employeeId: 'e2' }),
        line({ employeeId: 'e3' }),
      ],
      { debitIfsc: DEBIT_IFSC },
    );

    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.allValid).toBe(false);
  });

  it('reports every reason a line failed, not just the first', () => {
    // Otherwise fixing the IFSC only reveals the account problem on the next
    // round trip.
    const result = validateBatch(
      [
        line({
          ifsc: 'BAD',
          accountNumber: '12',
          amount: 0,
          beneficiaryName: '',
        }),
      ],
      { debitIfsc: DEBIT_IFSC },
    );

    expect(result.rejected[0].reasons.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps the original index so a rejection can be traced back', () => {
    const result = validateBatch([line(), line({ ifsc: 'BAD' })], {
      debitIfsc: DEBIT_IFSC,
    });

    expect(result.rejected[0].index).toBe(1);
  });

  it('resolves and records a payment mode per line', () => {
    const result = validateBatch(
      [line({ amount: 250000 }), line({ ifsc: 'HDFC0009999' })],
      { debitIfsc: DEBIT_IFSC },
    );

    expect(result.valid[0].paymentMode).toBe(PAYMENT_MODES.RTGS);
    expect(result.valid[1].paymentMode).toBe(PAYMENT_MODES.INTERNAL);
    expect(result.valid[0].paymentModeReason).toBeTruthy();
  });

  it('masks the account number on the accepted line', () => {
    const result = validateBatch([line()], { debitIfsc: DEBIT_IFSC });

    expect(result.valid[0].maskedAccountNumber).toBe('XXXXXXXX9012');
  });

  it('flags a repeated account without refusing it', () => {
    // Not automatically wrong — a rerun of a corrected line — but it is the
    // shape a double payment takes, so the decision belongs to whoever releases.
    const result = validateBatch([line(), line({ employeeId: 'e2' })], {
      debitIfsc: DEBIT_IFSC,
    });

    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].duplicateOfIndex).toBeNull();
    expect(result.valid[1].duplicateOfIndex).toBe(0);
  });

  it('does not flag two different accounts as duplicates', () => {
    const result = validateBatch(
      [line(), line({ accountNumber: '999888777666' })],
      { debitIfsc: DEBIT_IFSC },
    );

    expect(result.valid[1].duplicateOfIndex).toBeNull();
  });
});

describe('computeControlTotals', () => {
  it('sums in paise, not in floating-point rupees', () => {
    // Summing four hundred float rupee amounts and comparing to a bank's total
    // is how a file gets rejected for being one paisa out.
    const { valid } = validateBatch(
      [line({ amount: 0.1 }), line({ amount: 0.2, employeeId: 'e2' })],
      { debitIfsc: DEBIT_IFSC },
    );

    const totals = computeControlTotals(valid);

    expect(totals.totalAmountPaise).toBe(30);
    expect(totals.totalAmount).toBe(0.3);
  });

  it('counts the records', () => {
    const { valid } = validateBatch([line(), line({ employeeId: 'e2' })], {
      debitIfsc: DEBIT_IFSC,
    });

    expect(computeControlTotals(valid).recordCount).toBe(2);
  });

  it('produces a stable hash for identical bodies', () => {
    const { valid } = validateBatch([line()], { debitIfsc: DEBIT_IFSC });

    expect(computeControlTotals(valid).bodyHash).toBe(
      computeControlTotals(valid).bodyHash,
    );
  });

  it('handles an empty batch without dividing by zero', () => {
    const totals = computeControlTotals([]);

    expect(totals.recordCount).toBe(0);
    expect(totals.totalAmountPaise).toBe(0);
  });
});

describe('verifyControlTotals', () => {
  const build = () =>
    validateBatch([line(), line({ employeeId: 'e2' })], {
      debitIfsc: DEBIT_IFSC,
    }).valid;

  it('matches unchanged lines', () => {
    const lines = build();

    expect(
      verifyControlTotals(lines, computeControlTotals(lines)).matches,
    ).toBe(true);
  });

  it('detects an amount edited after generation', () => {
    const lines = build();
    const totals = computeControlTotals(lines);
    lines[0].amountPaise += 100;

    const result = verifyControlTotals(lines, totals);

    expect(result.matches).toBe(false);
    expect(result.differences.join(' ')).toMatch(/does not match/);
  });

  it('detects an account number swapped for another of the same value', () => {
    // The amount total is unchanged, so a count-and-sum check alone would pass.
    // This is exactly what the body hash is for.
    const lines = build();
    const totals = computeControlTotals(lines);
    lines[0].accountNumber = '999999999999';

    const result = verifyControlTotals(lines, totals);

    expect(result.matches).toBe(false);
    expect(result.differences.join(' ')).toMatch(/hash/);
  });

  it('detects a line removed', () => {
    const lines = build();
    const totals = computeControlTotals(lines);
    lines.pop();

    expect(verifyControlTotals(lines, totals).matches).toBe(false);
  });
});

describe('generateDelimitedFile', () => {
  const lines = () => validateBatch([line()], { debitIfsc: DEBIT_IFSC }).valid;

  it('emits a header row for a profile that wants one', () => {
    const result = generateDelimitedFile(batch(), lines(), 'hdfc');

    expect(result.ok).toBe(true);
    expect(result.content.split('\n')[0]).toContain(
      'Beneficiary Account Number',
    );
  });

  it('omits the header for a profile that does not', () => {
    const result = generateDelimitedFile(batch(), lines(), 'sbi');

    expect(result.content.split('\n')[0]).toContain('123456789012');
  });

  it('honours each profile column order', () => {
    // The differences between banks are entirely order and captions, which is
    // why the profiles are a table and not four generators.
    const hdfc = generateDelimitedFile(batch(), lines(), 'hdfc').content.split(
      '\n',
    )[1];
    const icici = generateDelimitedFile(
      batch(),
      lines(),
      'icici',
    ).content.split('\n')[1];

    expect(hdfc.split(',')[1]).toBe('123456789012');
    expect(icici.split(',')[2]).toBe('123456789012');
  });

  it('uses the profile delimiter', () => {
    expect(generateDelimitedFile(batch(), lines(), 'sbi').content).toContain(
      '|',
    );
  });

  it('writes amounts with two decimals', () => {
    const result = generateDelimitedFile(batch(), lines(), 'hdfc');

    expect(result.content).toContain('50000.00');
  });

  it('quotes a beneficiary name containing the delimiter', () => {
    const withComma = validateBatch([line({ beneficiaryName: 'Rao, Asha' })], {
      debitIfsc: DEBIT_IFSC,
    }).valid;

    expect(generateDelimitedFile(batch(), withComma, 'hdfc').content).toContain(
      '"Rao, Asha"',
    );
  });

  it('refuses an unknown profile and lists the known ones', () => {
    const result = generateDelimitedFile(batch(), lines(), 'barclays');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('hdfc');
  });
});

describe('generateNachFile', () => {
  const lines = () =>
    validateBatch([line(), line({ employeeId: 'e2', amount: 250000 })], {
      debitIfsc: DEBIT_IFSC,
    }).valid;

  it('emits a header, one detail per line and a trailer', () => {
    const result = generateNachFile(batch(), lines());
    const rows = recordsOf(result.content);

    expect(rows).toHaveLength(4);
    expect(rows[0].slice(0, 2)).toBe('01');
    expect(rows[1].slice(0, 2)).toBe('02');
    expect(rows[3].slice(0, 2)).toBe('09');
  });

  it('makes every record exactly the specified width', () => {
    // The whole contract of a fixed-width format: a parser at the other end
    // reads by offset, so one short record shifts every field after it and the
    // file is rejected wholesale.
    const result = generateNachFile(batch(), lines());

    for (const row of recordsOf(result.content)) {
      expect(row).toHaveLength(NACH_RECORD_LENGTH);
    }
  });

  it('holds the width with a name longer than its field', () => {
    const long = validateBatch([line({ beneficiaryName: 'A'.repeat(120) })], {
      debitIfsc: DEBIT_IFSC,
    }).valid;

    for (const row of recordsOf(generateNachFile(batch(), long).content)) {
      expect(row).toHaveLength(NACH_RECORD_LENGTH);
    }
  });

  it('writes amounts in paise with no decimal point', () => {
    const result = generateNachFile(batch(), lines());
    const detail = result.content.split('\n')[1];

    expect(detail).not.toContain('.');
    expect(detail).toContain('0000005000000'); // ₹50,000 as 13-digit paise
  });

  it('agrees with its own trailer', () => {
    const result = generateNachFile(batch(), lines());
    const trailer = recordsOf(result.content)[3];

    expect(trailer.slice(2, 9)).toBe('0000002');
    expect(Number(trailer.slice(9, 24))).toBe(result.totals.totalAmountPaise);
  });

  it('carries the same count and total in the header as in the trailer', () => {
    // The bank rejects the file when they disagree.
    const rows = recordsOf(generateNachFile(batch(), lines()).content);
    const header = rows[0];
    const trailer = rows[rows.length - 1];

    expect(header.slice(59, 66)).toBe(trailer.slice(2, 9));
    expect(header.slice(66, 81)).toBe(trailer.slice(9, 24));
  });

  it('zero-pads the serial so records sort correctly', () => {
    const result = generateNachFile(batch(), lines());

    expect(result.content.split('\n')[1].slice(2, 9)).toBe('0000001');
  });

  it('refuses to generate against an invalid debit account', () => {
    const result = generateNachFile(batch({ debitIfsc: 'BAD' }), lines());

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Debit account IFSC invalid');
  });

  it('still produces a well-formed file for an empty batch', () => {
    const result = generateNachFile(batch(), []);
    const rows = recordsOf(result.content);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.length === NACH_RECORD_LENGTH)).toBe(true);
  });
});

describe('parseReturnFile', () => {
  it('parses serial, account and reason code', () => {
    const { records } = parseReturnFile('1,123456789012,R01');

    expect(records[0]).toMatchObject({
      serial: 1,
      accountNumber: '123456789012',
      reasonCode: 'R01',
      reasonText: 'Account closed',
      retryable: false,
    });
  });

  it('skips a header row without matching a specific caption', () => {
    // Banks differ on the caption, and a reconciliation that refuses the file
    // over a header is a reconciliation nobody runs.
    const { records } = parseReturnFile(
      'Serial,Account,Reason\n1,123456789012,R01',
    );

    expect(records).toHaveLength(1);
  });

  it('ignores blank lines', () => {
    const { records } = parseReturnFile(
      '1,123456789012,R01\n\n\n2,999888777666,R02\n',
    );

    expect(records).toHaveLength(2);
  });

  it('separates a retryable failure from one that needs new bank details', () => {
    const { records } = parseReturnFile(
      '1,123456789012,R07\n2,999888777666,R01',
    );

    expect(records[0].retryable).toBe(true);
    expect(records[1].retryable).toBe(false);
  });

  it('carries an unrecognised code through rather than dropping it', () => {
    // The credit still bounced. Losing that because the reason table is out of
    // date would leave the row marked as paid.
    const { records } = parseReturnFile('1,123456789012,R99');

    expect(records).toHaveLength(1);
    expect(records[0].recognised).toBe(false);
    expect(records[0].retryable).toBe(false);
  });

  it('reports a malformed row instead of silently skipping it', () => {
    const { records, malformed } = parseReturnFile(
      '1,123456789012,R01\n2,oops',
    );

    expect(records).toHaveLength(1);
    expect(malformed[0].line).toBe(2);
  });
});

describe('reconcileReturns', () => {
  const built = () =>
    validateBatch(
      [
        line({ accountNumber: '111111111111' }),
        line({ accountNumber: '222222222222', employeeId: 'e2' }),
        line({
          accountNumber: '333333333333',
          employeeId: 'e3',
          amount: 20000,
        }),
      ],
      { debitIfsc: DEBIT_IFSC },
    ).valid;

  it('marks only the named lines as returned', () => {
    const { records } = parseReturnFile('2,222222222222,R01');
    const outcome = reconcileReturns(built(), records);

    expect(outcome.returnedCount).toBe(1);
    expect(outcome.creditedCount).toBe(2);
    expect(outcome.lines[1].status).toBe(LINE_STATUS.RETURNED);
    expect(outcome.lines[0].status).toBe(LINE_STATUS.CREDITED);
  });

  it('applies the reason text to the returned line', () => {
    const { records } = parseReturnFile('2,222222222222,R01');
    const outcome = reconcileReturns(built(), records);

    expect(outcome.lines[1].returnReasonCode).toBe('R01');
    expect(outcome.lines[1].returnReasonText).toBe('Account closed');
  });

  it('totals the returned amount', () => {
    const { records } = parseReturnFile('3,333333333333,R07');
    const outcome = reconcileReturns(built(), records);

    expect(outcome.returnedAmount).toBe(20000);
  });

  it('separates what can be re-issued from what needs new bank details', () => {
    // A closed account cannot simply go back out; a temporarily unfunded
    // remitter account can.
    const { records } = parseReturnFile(
      '1,111111111111,R07\n2,222222222222,R01',
    );
    const outcome = reconcileReturns(built(), records);

    expect(outcome.returnedAmount).toBe(100000);
    expect(outcome.reissuableAmount).toBe(50000);
    expect(outcome.needsNewBankDetails).toBe(1);
  });

  it('matches on the account number rather than the serial alone', () => {
    // A bank return is not guaranteed to preserve this file's ordering; the
    // account number is the thing both sides agree on.
    const { records } = parseReturnFile('99,222222222222,R01');
    const outcome = reconcileReturns(built(), records);

    expect(outcome.lines[1].status).toBe(LINE_STATUS.RETURNED);
  });

  it('reports a return for an account this batch never contained', () => {
    // Usually the wrong file. Silently succeeding would mark the whole batch as
    // credited on the strength of somebody else's failures.
    const { records } = parseReturnFile('1,444444444444,R01');
    const outcome = reconcileReturns(built(), records);

    expect(outcome.unmatchedReturns).toHaveLength(1);
    expect(outcome.returnedCount).toBe(0);
  });

  it('does not double-count a repeated return for the same line', () => {
    const { records } = parseReturnFile(
      '2,222222222222,R01\n2,222222222222,R01',
    );
    const outcome = reconcileReturns(built(), records);

    expect(outcome.returnedCount).toBe(1);
    expect(outcome.returnedAmount).toBe(50000);
  });

  it('reports a clean run as fully credited', () => {
    const outcome = reconcileReturns(built(), []);

    expect(outcome.fullyCredited).toBe(true);
    expect(outcome.creditedCount).toBe(3);
    expect(outcome.returnedAmount).toBe(0);
  });
});
