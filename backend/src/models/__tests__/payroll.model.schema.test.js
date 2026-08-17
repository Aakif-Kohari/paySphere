/**
 * The payroll schema is complete, and stays complete.
 *
 * `models/payroll.model.js` was reassembled in #792 after #785's merge spliced a
 * second copy of the schema body into the middle of its `status:` field, which
 * left the file unparseable. The union of the two copies is what the product
 * needs — and the risk when you reconcile two versions of a 250-line schema by
 * hand is that a field quietly does not make it across.
 *
 * That failure mode is invisible at runtime. Mongoose runs in strict mode: an
 * undeclared path is silently dropped from `$set` and from `create()`, so the
 * controller writing it looks like it worked and the value simply is not there
 * on the next read. #559 is that exact bug — six approval fields the controller
 * wrote and the schema never declared — and it went unnoticed through a full
 * release.
 *
 * So: every path that any controller, job or migration writes is asserted here
 * by name.
 */

const mongoose = require('mongoose');
const PayrollUpdate = require('../payroll.model');
const { ALL_STATUSES, PAYROLL_STATUS } = require('../../config/payrollStatus');

const paths = PayrollUpdate.schema.paths;
const has = (name) => Object.prototype.hasOwnProperty.call(paths, name);

describe('PayrollUpdate schema (#792)', () => {
  describe('the identity of a row', () => {
    it.each([
      'employeeId',
      'employeeName',
      'month',
      'year',
      'currency',
      'tenantId',
      'createdBy',
    ])('declares %s', (field) => {
      expect(has(field)).toBe(true);
    });

    it('requires both the actor and the tenant', () => {
      // Two fields answering two questions, not one field doing both — the
      // conflation #613 had to unpick. `createdBy` records who ran it,
      // `tenantId` decides who can see it.
      expect(paths.createdBy.isRequired).toBe(true);
      expect(paths.tenantId.isRequired).toBe(true);
    });
  });

  describe('the money', () => {
    it.each([
      'baseSalary',
      'bonus',
      'deductions',
      'customDeductions',
      'leaveDeduction',
      'overtimePay',
      'overtimeRate',
      'overtimeHours',
      'leaveDays',
      'netSalary',
    ])('declares %s', (field) => {
      expect(has(field)).toBe(true);
    });
  });

  describe('the maker–checker trail (#559)', () => {
    it.each([
      'submittedBy',
      'submittedAt',
      'approvedBy',
      'approvedAt',
      'rejectedBy',
      'rejectedAt',
      'rejectionReason',
    ])('declares %s', (field) => {
      expect(has(field)).toBe(true);
    });

    it('caps the rejection reason', () => {
      const doc = new PayrollUpdate({ rejectionReason: 'x'.repeat(501) });
      const error = doc.validateSync();

      expect(error.errors.rejectionReason).toBeDefined();
    });

    it('populates submittedBy without tripping strictPopulate', () => {
      // The concrete symptom of #559: `getPendingApprovals` populates this
      // path, and mongoose throws on populating a path that is not in the
      // schema rather than returning nothing.
      expect(() => PayrollUpdate.find().populate('submittedBy')).not.toThrow();
    });
  });

  describe('status', () => {
    it('accepts the canonical vocabulary and nothing else', () => {
      expect(paths.status.enumValues).toEqual(
        expect.arrayContaining(ALL_STATUSES),
      );

      const doc = new PayrollUpdate({ status: 'not-a-status' });
      expect(doc.validateSync().errors.status).toBeDefined();
    });

    it('defaults to pending approval', () => {
      expect(new PayrollUpdate({}).status).toBe(
        PAYROLL_STATUS.PENDING_APPROVAL,
      );
    });

    it('folds the legacy spellings onto the canonical values', () => {
      // The `set` hook, which is what lets documents written by either older
      // revision keep validating.
      const doc = new PayrollUpdate({ status: 'PENDING_APPROVAL' });
      expect(ALL_STATUSES).toContain(doc.status);
    });
  });

  describe('the feature columns that later PRs added', () => {
    // These are the ones a badly-resolved merge is most likely to lose: each
    // arrived in a different PR, on a different branch, and only one of the two
    // duplicated copies of the schema had them.
    it.each([
      ['attendanceSource', '#459'],
      ['loanRecoveries', '#460'],
      ['loanRecoveryTotal', '#460'],
      ['salarySnapshot.effectiveGross', '#461'],
      ['salarySnapshot.isProrated', '#461'],
      ['salarySnapshot.segmentCount', '#461'],
      ['salarySnapshot.components', '#461'],
      ['reimbursements', '#719'],
      ['reimbursedExpenseIds', '#719'],
      ['payslipEmailed', '#560'],
      ['blockchainTxHash', '#693'],
      ['merkleRoot', '#693'],
      ['isDeleted', '#759'],
      ['deletedAt', '#759'],
    ])('declares %s (from %s)', (field) => {
      expect(has(field)).toBe(true);
    });

    it('defaults reimbursements to zero and refuses a negative one', () => {
      expect(new PayrollUpdate({}).reimbursements).toBe(0);

      const doc = new PayrollUpdate({ reimbursements: -1 });
      expect(doc.validateSync().errors.reimbursements).toBeDefined();
    });

    it('holds reimbursed claim ids as object ids', () => {
      const id = new mongoose.Types.ObjectId();
      const doc = new PayrollUpdate({ reimbursedExpenseIds: [String(id)] });

      expect(doc.reimbursedExpenseIds.map(String)).toEqual([String(id)]);
    });
  });

  describe('indexes', () => {
    const declared = PayrollUpdate.schema
      .indexes()
      .map(([fields]) => Object.keys(fields).join(','));

    it('keeps one row per employee per month per tenant', () => {
      const [, options] =
        PayrollUpdate.schema
          .indexes()
          .find(
            ([fields]) => fields.employeeId && fields.month && fields.year,
          ) || [];

      expect(options).toMatchObject({ unique: true });
    });

    it.each([
      'tenantId,status,createdAt',
      'tenantId,year,month,status',
      'tenantId,submittedBy,status',
    ])('still declares the %s index', (signature) => {
      // Every hot read filters on tenantId first (#613). Losing one of these
      // to a merge does not fail anything — it just collection-scans the
      // largest collection in the product.
      expect(declared).toContain(signature);
    });
  });
});
