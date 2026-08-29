/**
 * @fileoverview Salary disbursement — beneficiary validation, payment-mode
 * routing, bank file generation and return reconciliation.
 * @description Pure functions. No Mongoose, no filesystem, no network.
 *
 * Issue: #1075
 *
 * PaySphere computes payroll down to the rupee and then stops. `payroll.model.js`
 * has a `disbursed` status and nothing in the product produces the artefact that
 * actually moves the money. So the last mile of every run is a human reshaping a
 * CSV by hand for a bank portal — the highest-consequence manual step left, since
 * a transposed digit in an account number sends somebody's salary to a stranger
 * and nothing in the codebase would catch it.
 *
 * Three decisions are worth reading before the code:
 *
 *   - **Amounts are carried in paise, as integers.** A file that says
 *     `12345.67` is a file the bank parses as a string; getting there through
 *     JavaScript floats means `0.1 + 0.2` territory in a document that causes an
 *     irreversible transfer. Rupees are converted to integer paise once, at the
 *     edge, and every total is summed in paise.
 *
 *   - **Payment mode is resolved by rule, never taken from input.** Which rail a
 *     credit goes out on is regulation, not preference: RTGS has a ₹2,00,000
 *     floor, and an intra-bank credit should never be sent over an interbank
 *     rail at all. The reason for each choice is recorded so an auditor can see
 *     why.
 *
 *   - **Validation partitions rather than throws.** One malformed beneficiary in
 *     a run of four hundred must not sink the run, and must not be silently
 *     dropped either. `validateBatch` returns both halves with a per-line
 *     reason, and the batch cannot be released while the rejected half is
 *     non-empty.
 */

'use strict';

const crypto = require('crypto');

/**
 * IFSC: four alphabetic bank characters, a literal `0` reserved by RBI, then six
 * alphanumeric branch characters. The `0` is the part worth checking — it is the
 * cheapest way to catch a field that has been filled with something else
 * entirely.
 */
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Indian bank account numbers run 9–18 characters. */
const ACCOUNT_MIN_LENGTH = 9;
const ACCOUNT_MAX_LENGTH = 18;
const ACCOUNT_PATTERN = /^[0-9]+$/;

/** RTGS is the mandated rail at and above this value, in rupees. */
const RTGS_FLOOR_RUPEES = 200000;

/** IMPS per-transaction ceiling, in rupees. */
const IMPS_CEILING_RUPEES = 500000;

const PAYMENT_MODES = Object.freeze({
  INTERNAL: 'INTERNAL',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  IMPS: 'IMPS',
});

const BATCH_STATUS = Object.freeze({
  DRAFT: 'Draft',
  VALIDATED: 'Validated',
  RELEASED: 'Released',
  RECONCILED: 'Reconciled',
  FAILED: 'Failed',
});

const LINE_STATUS = Object.freeze({
  PENDING: 'Pending',
  RELEASED: 'Released',
  CREDITED: 'Credited',
  RETURNED: 'Returned',
  REJECTED: 'Rejected',
});

/**
 * Bank return reason codes.
 *
 * Kept as a table rather than passed through as opaque strings, because the
 * difference between "the account is closed" and "insufficient balance in the
 * *company's* account" decides whether the fix is to chase the employee or to
 * fund the account — and `retryable` is what the re-issue list is built from.
 */
const RETURN_REASONS = Object.freeze({
  R01: { text: 'Account closed', retryable: false },
  R02: { text: 'Account does not exist', retryable: false },
  R03: { text: 'Account frozen or blocked', retryable: false },
  R04: { text: 'Name mismatch with account', retryable: false },
  R05: { text: 'Invalid IFSC / branch not participating', retryable: false },
  R06: { text: 'Beneficiary bank unavailable', retryable: true },
  R07: { text: 'Remitter account insufficiently funded', retryable: true },
  R08: { text: 'Transaction limit exceeded for the rail', retryable: true },
});

/** Fixed-width NACH record length. Every record type pads to exactly this. */
const NACH_RECORD_LENGTH = 100;

/**
 * Rupees to integer paise.
 *
 * The rounding is the point. `Math.round(12345.675 * 100)` is 1234567 or 1234568
 * depending on the binary representation, so the epsilon nudge makes it
 * deterministic — and a payment file is not a place for a value that depends on
 * how it was computed.
 *
 * @param {number} rupees
 * @returns {number} integer paise
 */
function toPaise(rupees) {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100);
}

/**
 * Integer paise back to rupees, for display only.
 *
 * @param {number} paise
 * @returns {number}
 */
function toRupees(paise) {
  const n = Number(paise);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
}

/**
 * Validate an IFSC.
 *
 * @param {string} ifsc
 * @returns {{valid: boolean, reason: string|null, bankCode?: string, branchCode?: string}}
 */
function validateIfsc(ifsc) {
  const value = String(ifsc || '')
    .trim()
    .toUpperCase();

  if (!value) return { valid: false, reason: 'IFSC is missing' };
  if (value.length !== 11) {
    return {
      valid: false,
      reason: `IFSC must be 11 characters, got ${value.length}`,
    };
  }
  if (!IFSC_PATTERN.test(value)) {
    return {
      valid: false,
      reason: 'IFSC must be 4 letters, then 0, then 6 alphanumerics',
    };
  }

  return {
    valid: true,
    reason: null,
    ifsc: value,
    bankCode: value.slice(0, 4),
    branchCode: value.slice(5),
  };
}

/**
 * Validate an account number.
 *
 * @param {string|number} accountNumber
 * @returns {{valid: boolean, reason: string|null, accountNumber?: string}}
 */
function validateAccountNumber(accountNumber) {
  // Coerced through String because a numeric account number loses its leading
  // zeros the moment it becomes a Number, and a leading zero is part of the
  // account. This is why the model stores it as a string.
  const value = String(accountNumber ?? '').trim();

  if (!value) return { valid: false, reason: 'Account number is missing' };
  if (!ACCOUNT_PATTERN.test(value)) {
    return { valid: false, reason: 'Account number must be digits only' };
  }
  if (value.length < ACCOUNT_MIN_LENGTH || value.length > ACCOUNT_MAX_LENGTH) {
    return {
      valid: false,
      reason: `Account number must be ${ACCOUNT_MIN_LENGTH}-${ACCOUNT_MAX_LENGTH} digits, got ${value.length}`,
    };
  }

  return { valid: true, reason: null, accountNumber: value };
}

/**
 * Mask an account number for display, keeping the last four digits.
 *
 * Four is the number a payroll clerk needs to confirm they are looking at the
 * right person and the smallest that does the job. `dataMask.middleware.js`
 * exists for precisely this reason; a disbursement API echoing full account
 * numbers back in JSON would walk straight past it.
 *
 * @param {string|number} accountNumber
 * @returns {string}
 */
function maskAccountNumber(accountNumber) {
  const value = String(accountNumber ?? '').trim();
  if (!value) return '';
  if (value.length <= 4) return 'X'.repeat(value.length);
  return 'X'.repeat(value.length - 4) + value.slice(-4);
}

/**
 * Decide which rail a credit goes out on.
 *
 * Rules, in the order they are applied:
 *
 *   1. Same bank as the debit account → an internal book transfer. Sending it
 *      over NEFT would pay an interbank rail to move money between two accounts
 *      at the same bank, and would settle in batches instead of instantly.
 *   2. At or above ₹2,00,000 → RTGS. That is the regulatory floor, not a
 *      preference.
 *   3. Otherwise NEFT, or IMPS when the caller asks for it and the amount is
 *      inside the IMPS ceiling.
 *
 * The `reason` is returned and stored, because "why did this one go out on
 * RTGS" is a question that gets asked months later.
 *
 * @param {object} input
 * @param {number} input.amount rupees
 * @param {string} input.beneficiaryIfsc
 * @param {string} input.debitIfsc
 * @param {boolean} [input.preferImps]
 * @returns {{mode: string|null, reason: string}}
 */
function resolvePaymentMode({
  amount,
  beneficiaryIfsc,
  debitIfsc,
  preferImps = false,
}) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return { mode: null, reason: 'Amount must be a positive number' };
  }

  const beneficiary = validateIfsc(beneficiaryIfsc);
  if (!beneficiary.valid) {
    return {
      mode: null,
      reason: `Beneficiary IFSC invalid: ${beneficiary.reason}`,
    };
  }

  const debit = validateIfsc(debitIfsc);

  if (debit.valid && debit.bankCode === beneficiary.bankCode) {
    return {
      mode: PAYMENT_MODES.INTERNAL,
      reason: `Same bank (${beneficiary.bankCode}) as the debit account — internal transfer`,
    };
  }

  if (value >= RTGS_FLOOR_RUPEES) {
    return {
      mode: PAYMENT_MODES.RTGS,
      reason: `Amount is at or above the RTGS floor of ${RTGS_FLOOR_RUPEES}`,
    };
  }

  if (preferImps && value <= IMPS_CEILING_RUPEES) {
    return {
      mode: PAYMENT_MODES.IMPS,
      reason: `Below the RTGS floor and within the IMPS ceiling of ${IMPS_CEILING_RUPEES}`,
    };
  }

  return {
    mode: PAYMENT_MODES.NEFT,
    reason: `Below the RTGS floor of ${RTGS_FLOOR_RUPEES}`,
  };
}

/**
 * Partition a batch into lines that can be sent and lines that cannot.
 *
 * Every rejection carries every reason it failed, not the first: telling a
 * payroll clerk the IFSC is wrong, waiting for them to fix it and then telling
 * them the account number is wrong too is a needless second round trip.
 *
 * @param {Array<object>} lines
 * @param {object} options `{ debitIfsc, preferImps }`
 * @returns {{valid: Array<object>, rejected: Array<object>, allValid: boolean}}
 */
function validateBatch(lines = [], options = {}) {
  const valid = [];
  const rejected = [];
  const seenAccounts = new Map();

  lines.forEach((line, index) => {
    const reasons = [];

    const ifsc = validateIfsc(line?.ifsc);
    if (!ifsc.valid) reasons.push(ifsc.reason);

    const account = validateAccountNumber(line?.accountNumber);
    if (!account.valid) reasons.push(account.reason);

    const amount = Number(line?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      reasons.push('Amount must be a positive number');
    }

    const name = String(line?.beneficiaryName || '').trim();
    if (!name) reasons.push('Beneficiary name is missing');

    let routing = { mode: null, reason: null };
    if (reasons.length === 0) {
      routing = resolvePaymentMode({
        amount,
        beneficiaryIfsc: ifsc.ifsc,
        debitIfsc: options.debitIfsc,
        preferImps: options.preferImps,
      });
      if (!routing.mode) reasons.push(routing.reason);
    }

    if (reasons.length > 0) {
      rejected.push({ index, employeeId: line?.employeeId ?? null, reasons });
      return;
    }

    // Two lines crediting the same account in one run is not automatically
    // wrong — a rerun of a corrected line, an employee with two payroll rows —
    // but it is the shape a double payment takes, so it is flagged rather than
    // refused. The decision belongs to whoever releases the batch.
    const accountKey = `${ifsc.ifsc}:${account.accountNumber}`;
    const duplicateOf = seenAccounts.get(accountKey);
    seenAccounts.set(accountKey, index);

    valid.push({
      index,
      employeeId: line?.employeeId ?? null,
      beneficiaryName: name,
      accountNumber: account.accountNumber,
      maskedAccountNumber: maskAccountNumber(account.accountNumber),
      ifsc: ifsc.ifsc,
      bankCode: ifsc.bankCode,
      amount,
      amountPaise: toPaise(amount),
      paymentMode: routing.mode,
      paymentModeReason: routing.reason,
      duplicateOfIndex: duplicateOf === undefined ? null : duplicateOf,
    });
  });

  return { valid, rejected, allValid: rejected.length === 0 };
}

/**
 * Record count, amount total and a body hash.
 *
 * Every bank file format carries a trailer with a count and a sum, and the bank
 * rejects the whole file when they disagree with the body. The hash is the
 * additional check: it covers the fields that actually move money — account,
 * IFSC and amount — so a file edited between generation and upload no longer
 * matches its own trailer.
 *
 * Summed in paise. Summing four hundred floating-point rupee amounts and
 * comparing the result to a bank's total is how a file gets rejected for being
 * one paisa out.
 *
 * @param {Array<object>} lines validated lines
 * @returns {{recordCount: number, totalAmountPaise: number, totalAmount: number, bodyHash: string}}
 */
function computeControlTotals(lines = []) {
  let totalAmountPaise = 0;
  const canonical = [];

  for (const line of lines) {
    const paise = Number.isFinite(line?.amountPaise)
      ? line.amountPaise
      : toPaise(line?.amount);

    totalAmountPaise += paise;
    canonical.push(`${line?.accountNumber}|${line?.ifsc}|${paise}`);
  }

  return {
    recordCount: lines.length,
    totalAmountPaise,
    totalAmount: toRupees(totalAmountPaise),
    bodyHash: crypto
      .createHash('sha256')
      .update(canonical.join('\n'))
      .digest('hex'),
  };
}

/**
 * Do a set of lines still match the totals recorded when they were generated?
 *
 * @param {Array<object>} lines
 * @param {object} totals
 * @returns {{matches: boolean, differences: string[]}}
 */
function verifyControlTotals(lines, totals) {
  const recomputed = computeControlTotals(lines);
  const differences = [];

  if (recomputed.recordCount !== totals?.recordCount) {
    differences.push(
      `Record count ${recomputed.recordCount} does not match the recorded ${totals?.recordCount}`,
    );
  }
  if (recomputed.totalAmountPaise !== totals?.totalAmountPaise) {
    differences.push(
      `Total ${toRupees(recomputed.totalAmountPaise)} does not match the recorded ${toRupees(totals?.totalAmountPaise)}`,
    );
  }
  if (recomputed.bodyHash !== totals?.bodyHash) {
    differences.push(
      'Body hash does not match — the file contents have changed',
    );
  }

  return { matches: differences.length === 0, differences };
}

/**
 * Per-bank column layouts for the delimited upload format.
 *
 * A table rather than a `switch`, because the differences between banks are
 * entirely in column order and header text. Branching on the bank name puts
 * four nearly-identical generators in the file and guarantees that a fix
 * applied to one is missed on the others.
 */
const BANK_PROFILES = Object.freeze({
  hdfc: {
    label: 'HDFC Bank — bulk salary upload',
    delimiter: ',',
    includeHeader: true,
    columns: [
      { header: 'Transaction Type', value: (line) => line.paymentMode },
      {
        header: 'Beneficiary Account Number',
        value: (line) => line.accountNumber,
      },
      { header: 'Beneficiary Name', value: (line) => line.beneficiaryName },
      {
        header: 'Amount',
        value: (line) => toRupees(line.amountPaise).toFixed(2),
      },
      { header: 'Beneficiary IFSC', value: (line) => line.ifsc },
      {
        header: 'Payment Reference',
        value: (line, i, batch) => `${batch.batchReference}-${i + 1}`,
      },
    ],
  },
  icici: {
    label: 'ICICI Bank — corporate internet banking',
    delimiter: ',',
    includeHeader: true,
    columns: [
      { header: 'PYMT_MODE', value: (line) => line.paymentMode },
      {
        header: 'PYMT_DATE',
        value: (line, i, batch) => formatDate(batch.valueDate),
      },
      { header: 'BENE_ACCT_NO', value: (line) => line.accountNumber },
      { header: 'BENE_NAME', value: (line) => line.beneficiaryName },
      { header: 'BENE_IFSC', value: (line) => line.ifsc },
      {
        header: 'AMOUNT',
        value: (line) => toRupees(line.amountPaise).toFixed(2),
      },
    ],
  },
  sbi: {
    label: 'State Bank of India — bulk transfer',
    delimiter: '|',
    includeHeader: false,
    columns: [
      { header: 'SRL', value: (line, i) => String(i + 1) },
      { header: 'ACCOUNT', value: (line) => line.accountNumber },
      { header: 'IFSC', value: (line) => line.ifsc },
      {
        header: 'AMOUNT',
        value: (line) => toRupees(line.amountPaise).toFixed(2),
      },
      { header: 'NAME', value: (line) => line.beneficiaryName },
      { header: 'MODE', value: (line) => line.paymentMode },
    ],
  },
});

/**
 * `YYYYMMDD`, in UTC.
 *
 * UTC deliberately: a value date rendered in the server's local zone shifts by a
 * day for any deployment east or west of the one the developer tested in, and a
 * salary file dated a day late is a salary paid a day late.
 *
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '00000000';

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

/**
 * Escape one delimited field.
 *
 * A beneficiary name containing a comma — "Rao, Asha" as it appears on the
 * account — would otherwise shift every subsequent column by one, and the bank
 * would read the IFSC as the amount.
 *
 * @param {string} value
 * @param {string} delimiter
 * @returns {string}
 */
function escapeField(value, delimiter) {
  const text = String(value ?? '');
  if (
    !text.includes(delimiter) &&
    !text.includes('"') &&
    !text.includes('\n')
  ) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Generate the delimited upload file for a bank profile.
 *
 * @param {object} batch
 * @param {Array<object>} lines validated lines
 * @param {string} profileKey key into BANK_PROFILES
 * @returns {{ok: boolean, error?: string, content?: string, profile?: string, recordCount?: number}}
 */
function generateDelimitedFile(batch, lines = [], profileKey = 'hdfc') {
  const profile = BANK_PROFILES[String(profileKey || '').toLowerCase()];

  if (!profile) {
    return {
      ok: false,
      error: `Unknown bank profile '${profileKey}'. Known: ${Object.keys(BANK_PROFILES).join(', ')}`,
    };
  }

  const rows = [];

  if (profile.includeHeader) {
    rows.push(
      profile.columns.map((column) => column.header).join(profile.delimiter),
    );
  }

  lines.forEach((line, index) => {
    rows.push(
      profile.columns
        .map((column) =>
          escapeField(column.value(line, index, batch), profile.delimiter),
        )
        .join(profile.delimiter),
    );
  });

  return {
    ok: true,
    profile: profile.label,
    recordCount: lines.length,
    content: `${rows.join('\n')}\n`,
  };
}

/**
 * Pad or truncate to an exact width.
 *
 * Truncation is silent by design in a fixed-width format — the field simply has
 * no room — but it is only ever applied to descriptive fields. Account numbers,
 * IFSCs and amounts are validated to fit before they reach here, so a truncated
 * one would be a bug rather than a formatting decision.
 *
 * @param {string|number} value
 * @param {number} width
 * @param {'left'|'right'} align
 * @param {string} padChar
 * @returns {string}
 */
function fixedWidth(value, width, align = 'left', padChar = ' ') {
  const text = String(value ?? '').slice(0, width);
  return align === 'right'
    ? text.padStart(width, padChar)
    : text.padEnd(width, padChar);
}

/**
 * Generate a fixed-width NACH file: one header, N details, one trailer.
 *
 * Every record is exactly `NACH_RECORD_LENGTH` characters. That is the whole
 * contract of the format — a parser at the other end reads by offset, so a
 * record one character short shifts every field after it and the file is
 * rejected wholesale.
 *
 * Amounts are written in paise so no decimal point ever appears in the file.
 *
 * @param {object} batch
 * @param {Array<object>} lines validated lines
 * @returns {{ok: boolean, error?: string, content?: string, recordCount?: number, totals?: object}}
 */
function generateNachFile(batch, lines = []) {
  const debit = validateIfsc(batch?.debitIfsc);
  if (!debit.valid) {
    return { ok: false, error: `Debit account IFSC invalid: ${debit.reason}` };
  }

  const debitAccount = validateAccountNumber(batch?.debitAccountNumber);
  if (!debitAccount.valid) {
    return {
      ok: false,
      error: `Debit account invalid: ${debitAccount.reason}`,
    };
  }

  const totals = computeControlTotals(lines);
  const reference = String(batch?.batchReference || '').trim();

  const header = [
    fixedWidth('01', 2),
    fixedWidth(reference, 20),
    fixedWidth(formatDate(batch?.valueDate), 8),
    fixedWidth(debitAccount.accountNumber, 18, 'right', '0'),
    fixedWidth(debit.ifsc, 11),
    fixedWidth(totals.recordCount, 7, 'right', '0'),
    fixedWidth(totals.totalAmountPaise, 15, 'right', '0'),
    fixedWidth('', 19),
  ].join('');

  const details = lines.map((line, index) =>
    [
      fixedWidth('02', 2),
      fixedWidth(index + 1, 7, 'right', '0'),
      fixedWidth(line.beneficiaryName, 40),
      fixedWidth(line.accountNumber, 18, 'right', '0'),
      fixedWidth(line.ifsc, 11),
      fixedWidth(line.amountPaise, 13, 'right', '0'),
      fixedWidth(line.paymentMode, 8),
      fixedWidth('', 1),
    ].join(''),
  );

  const trailer = [
    fixedWidth('09', 2),
    fixedWidth(totals.recordCount, 7, 'right', '0'),
    fixedWidth(totals.totalAmountPaise, 15, 'right', '0'),
    // First 16 hex characters of the body hash. The full digest does not fit the
    // record and 64 bits of it is ample for detecting an accidental edit, which
    // is what this guards against — the file never leaves the operator's hands
    // unsigned, so it is not a defence against a determined forger.
    fixedWidth(totals.bodyHash.slice(0, 16), 16),
    fixedWidth('', 60),
  ].join('');

  return {
    ok: true,
    recordCount: totals.recordCount,
    totals,
    content: `${[header, ...details, trailer].join('\n')}\n`,
  };
}

/**
 * Parse a bank return file.
 *
 * Format, one record per line: `serial,accountNumber,reasonCode`. Blank lines
 * and a leading header row are tolerated, because banks vary on both and a
 * reconciliation that refuses the file over a header is a reconciliation nobody
 * runs.
 *
 * @param {string} content
 * @returns {{records: Array<object>, malformed: Array<object>}}
 */
function parseReturnFile(content) {
  const records = [];
  const malformed = [];

  const lines = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  lines.forEach((line, index) => {
    const parts = line.split(',').map((part) => part.trim());

    // A header row. Detected by its first field not being numeric rather than by
    // matching an expected caption, since the caption differs per bank.
    if (index === 0 && parts[0] && !/^\d+$/.test(parts[0])) return;

    if (parts.length < 3) {
      malformed.push({
        line: index + 1,
        raw: line,
        reason: 'Expected 3 comma-separated fields',
      });
      return;
    }

    const [serial, accountNumber, reasonCode] = parts;
    const code = String(reasonCode).toUpperCase();
    const known = RETURN_REASONS[code];

    records.push({
      serial: Number(serial),
      accountNumber: String(accountNumber),
      reasonCode: code,
      // An unrecognised code is carried through rather than dropped. The credit
      // still bounced, and losing that because the reason table is out of date
      // would leave the row marked as paid.
      reasonText: known ? known.text : `Unrecognised return code ${code}`,
      retryable: known ? known.retryable : false,
      recognised: Boolean(known),
    });
  });

  return { records, malformed };
}

/**
 * Apply a parsed return file to a batch's lines.
 *
 * Matched on the account number rather than on the serial alone. A serial is
 * this file's ordering and a bank return is not guaranteed to preserve it; the
 * account number is the thing both sides agree on. The serial is used as a
 * tiebreak when the same account appears twice.
 *
 * @param {Array<object>} lines
 * @param {Array<object>} returnRecords
 * @returns {object}
 */
function reconcileReturns(lines = [], returnRecords = []) {
  const byAccount = new Map();
  lines.forEach((line, index) => {
    const key = String(line.accountNumber);
    if (!byAccount.has(key)) byAccount.set(key, []);
    byAccount.get(key).push({ line, index });
  });

  const reconciled = lines.map((line) => ({
    ...line,
    status: LINE_STATUS.CREDITED,
    returnReasonCode: null,
    returnReasonText: null,
  }));

  const unmatched = [];
  let returnedPaise = 0;
  let retryablePaise = 0;
  let returnedCount = 0;

  for (const record of returnRecords) {
    const candidates = byAccount.get(String(record.accountNumber)) || [];

    const match =
      candidates.find((entry) => entry.index + 1 === record.serial) ||
      candidates[0];

    if (!match) {
      // A return for a credit this batch never contained. Reported rather than
      // ignored — it usually means the wrong return file was uploaded, and
      // silently succeeding would mark a whole batch as credited on the strength
      // of somebody else's failures.
      unmatched.push(record);
      continue;
    }

    const target = reconciled[match.index];

    // A second return for the same line does not double-count.
    if (target.status === LINE_STATUS.RETURNED) continue;

    target.status = LINE_STATUS.RETURNED;
    target.returnReasonCode = record.reasonCode;
    target.returnReasonText = record.reasonText;
    target.retryable = record.retryable;

    returnedCount += 1;
    returnedPaise += target.amountPaise;
    if (record.retryable) retryablePaise += target.amountPaise;
  }

  const creditedCount = reconciled.length - returnedCount;

  return {
    lines: reconciled,
    creditedCount,
    returnedCount,
    returnedAmount: toRupees(returnedPaise),
    // What can go back out as-is. A closed account needs new bank details from
    // the employee first, so it is deliberately not in this figure.
    reissuableAmount: toRupees(retryablePaise),
    needsNewBankDetails: reconciled.filter(
      (line) => line.status === LINE_STATUS.RETURNED && !line.retryable,
    ).length,
    unmatchedReturns: unmatched,
    fullyCredited: returnedCount === 0,
  };
}

module.exports = {
  IFSC_PATTERN,
  RTGS_FLOOR_RUPEES,
  IMPS_CEILING_RUPEES,
  NACH_RECORD_LENGTH,
  PAYMENT_MODES,
  BATCH_STATUS,
  LINE_STATUS,
  RETURN_REASONS,
  BANK_PROFILES,
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
};
