/**
 * @fileoverview POSH Grievance, ICC & Ethics Committee Schemas
 * @description Cryptographically secure schemas for anonymous reporting,
 * Internal Complaints Committee (ICC) case management, votes, SLA tracking,
 * and whistleblower reports with ethics committee management.
 */
const mongoose = require('mongoose');

// ============================================================================
// ICC Committee Schema
// ============================================================================

const iccCommitteeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['Presiding Officer', 'Internal Member', 'External Member'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    decryptionPinHash: { type: String, required: true }, // Bcrypt hash of secondary PIN
    /**
     * Whether this member counts towards the statutory minimum-women share
     * (#1157).
     *
     * Recorded explicitly on the membership rather than inferred from anything on
     * the user record. This is a statutory quota that decides whether a verdict
     * stands, so it has to come from something a person deliberately entered when
     * constituting the committee, not from a guess about a name or a title.
     */
    isWoman: { type: Boolean, default: false },
  },
  { timestamps: true },
);

iccCommitteeSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
const ICCCommittee = mongoose.model('ICCCommittee', iccCommitteeSchema);

// ============================================================================
// Grievance Schema (POSH)
// ============================================================================

const grievanceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    caseNumber: { type: String, required: true, unique: true }, // e.g., POSH-2024-001
    complainantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    }, // Null = Anonymous
    respondentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    incidentDate: { type: Date, required: true },
    // Encrypted fields (AES-256-GCM)
    encryptedDescription: { type: String, required: true },
    encryptionIV: { type: String, required: true },
    status: {
      type: String,
      enum: ['Filed', 'Under Inquiry', 'Resolved', 'Dismissed'],
      default: 'Filed',
    },
    finalVerdict: {
      type: String,
      enum: ['Pending', 'Upheld', 'Dismissed', 'Inconclusive'],
      default: 'Pending',
    },
    inquiryReport: { type: String, default: null },
    resolutionDate: { type: Date, default: null },
    /**
     * @deprecated Superseded by the `escalations` ledger below (#1157).
     *
     * A single boolean could record that *an* alert had gone out and nothing
     * else — not which rung, not to whom, not when — so a case could be
     * escalated at most once ever, and a case sitting at 89 days looked
     * identical to one sitting at 200. Kept on the schema so existing documents
     * still load; nothing reads it any more.
     */
    isSLAAlertSent: { type: Boolean, default: false },
    filedAt: { type: Date, default: Date.now },
    slaDeadline: { type: Date, required: true }, // filedAt + 90 days, then extensions

    // --- Escalation, extension and interim relief (#1157) ---------------------

    /**
     * Every rung raised, once each.
     *
     * The ledger is what makes escalation idempotent: `resolveEscalationLevel`
     * diffs the rungs a case has reached against the ones recorded here, so
     * re-evaluating on a later day raises what is new and does not page the same
     * person again on every run.
     */
    escalations: [
      {
        _id: false,
        levelKey: {
          type: String,
          enum: ['PRESIDING_OFFICER', 'ICC', 'EMPLOYER', 'STATUTORY_AUTHORITY'],
          required: true,
        },
        level: { type: Number, required: true },
        notify: { type: String, default: '' },
        raisedAt: { type: Date, default: Date.now },
        raisedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
      },
    ],

    /**
     * Statutory extensions of the inquiry period.
     *
     * `slaDeadline` moves with each one. The reason is required rather than
     * optional: the Act's requirement is that an extension is recorded in
     * writing with reasons, and an extension with an empty reason field is the
     * thing that requirement exists to prevent.
     */
    extensions: [
      {
        _id: false,
        days: { type: Number, required: true, min: 1 },
        reason: { type: String, required: true, maxlength: 1000 },
        previousDeadline: { type: Date, required: true },
        revisedDeadline: { type: Date, required: true },
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        approvedAt: { type: Date, default: Date.now },
      },
    ],

    /**
     * Interim relief, on its own and much shorter clock.
     *
     * A complainant asking to be moved away from the respondent cannot wait
     * ninety days for an answer, so this is tracked and breached independently
     * of the inquiry deadline. A case can be perfectly compliant on one clock
     * and badly overdue on the other.
     */
    interimReliefRequestedAt: { type: Date, default: null },
    interimReliefDecidedAt: { type: Date, default: null },
    interimReliefGranted: { type: Boolean, default: false },
    interimReliefNote: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true },
);

grievanceSchema.index({ tenantId: 1, status: 1 });
const Grievance = mongoose.model('Grievance', grievanceSchema);

// ============================================================================
// Case Note Schema
// ============================================================================

const caseNoteSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    grievanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }, // Must be ICC member
    encryptedNote: { type: String, required: true },
    encryptionIV: { type: String, required: true },
    noteType: {
      type: String,
      enum: ['Hearing', 'Evidence', 'Finding', 'General'],
      default: 'General',
    },
  },
  { timestamps: true },
);

const CaseNote = mongoose.model('CaseNote', caseNoteSchema);

// ============================================================================
// ICC Vote Schema
// ============================================================================

const iccVoteSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    grievanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grievance',
      required: true,
      index: true,
    },
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    verdict: {
      type: String,
      enum: ['Upheld', 'Dismissed', 'Inconclusive'],
      required: true,
    },
    comments: { type: String, default: '' },
    votedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

iccVoteSchema.index({ grievanceId: 1, voterId: 1 }, { unique: true });
const ICCVote = mongoose.model('ICCVote', iccVoteSchema);

// ============================================================================
// Grievance Report Schema (Whistleblower - Issue #1207)
// ============================================================================

const grievanceReportSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    // Anonymous tracking token (generated for the reporter to check status later)
    trackingToken: { type: String, required: true, unique: true, index: true },

    // Encrypted Payloads (AES-256-GCM)
    encryptedTitle: { type: String, required: true },
    encryptedBody: { type: String, required: true },
    encryptedAttachments: [{ type: String }], // Array of encrypted file URLs/paths

    // Encryption metadata (IV and AuthTag for AES-GCM)
    iv: { type: String, required: true },
    authTag: { type: String, required: true },

    status: {
      type: String,
      enum: ['Submitted', 'Under Investigation', 'Resolved', 'Dismissed'],
      default: 'Submitted',
      index: true,
    },

    // Audit trail for decryption access
    accessLogs: [
      {
        accessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        accessedAt: { type: Date, default: Date.now },
        action: {
          type: String,
          enum: ['Decrypted', 'Status Updated', 'Comment Added'],
        },
      },
    ],

    resolutionNotes: { type: String, default: '' }, // Also encrypted in production
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const GrievanceReport = mongoose.model('GrievanceReport', grievanceReportSchema);

// ============================================================================
// Ethics Committee Schema (Issue #1207)
// ============================================================================

const ethicsCommitteeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['Chairperson', 'Member', 'Legal Counsel'],
      default: 'Member',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ethicsCommitteeSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
const EthicsCommittee = mongoose.model('EthicsCommittee', ethicsCommitteeSchema);

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  ICCCommittee,
  Grievance,
  CaseNote,
  ICCVote,
  GrievanceReport,
  EthicsCommittee,
};
