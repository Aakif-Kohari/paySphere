/**
 * @fileoverview Job requisition, candidate and interview feedback schemas.
 * @description Issue: #1074
 *
 * `stageHistory` on the candidate is append-only and is not decoration: it is
 * the only source `funnelMetrics` and `timeToHire` have. Conversion is computed
 * from the stages a candidate *reached*, not from where they are sitting now,
 * because everyone who was ever offered has since moved on to hired or
 * declined — so current occupancy reports an offer stage of zero for a team
 * that is hiring fine.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');
const {
  PIPELINE_STAGES,
  REQUISITION_STATUS,
  RECOMMENDATIONS,
} = require('../utils/recruitmentPipeline');

const jobRequisitionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    requisitionCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: String, default: '', trim: true, maxlength: 100 },
    location: { type: String, default: '', trim: true, maxlength: 120 },
    employmentType: {
      type: String,
      enum: ['FullTime', 'PartTime', 'Contract', 'Intern'],
      default: 'FullTime',
    },

    openings: { type: Number, required: true, min: 1, max: 500 },

    /**
     * The CTC band finance approved when the headcount was signed off.
     *
     * Both ends are required. A band with only a maximum reads as a cap and a
     * band with only a minimum reads as a floor, and `checkOfferAgainstBand`
     * needs both to say anything useful — so a half-specified band is recorded
     * as no band at all rather than as a one-sided one.
     */
    ctcBandMin: { type: Number, required: true, min: 0 },
    ctcBandMax: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },

    status: {
      type: String,
      enum: Object.values(REQUISITION_STATUS),
      default: REQUISITION_STATUS.DRAFT,
      index: true,
    },

    hiringManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    targetStartDate: { type: Date, default: null },
    justification: { type: String, default: '', maxlength: 2000 },

    openedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

jobRequisitionSchema.index(
  { tenantId: 1, requisitionCode: 1 },
  { unique: true },
);
jobRequisitionSchema.index({ tenantId: 1, status: 1, department: 1 });

/**
 * A band whose maximum is below its minimum is not a band.
 *
 * Checked here rather than as two independent `min:` constraints because the
 * problem is the relationship, and neither field is wrong on its own.
 */
jobRequisitionSchema.pre('validate', function validateBand(next) {
  if (
    Number.isFinite(this.ctcBandMin) &&
    Number.isFinite(this.ctcBandMax) &&
    this.ctcBandMax < this.ctcBandMin
  ) {
    return next(new Error('ctcBandMax cannot be lower than ctcBandMin'));
  }
  return next();
});

const stageHistorySchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      enum: Object.values(PIPELINE_STAGES),
      required: true,
    },
    previousStage: {
      type: String,
      enum: Object.values(PIPELINE_STAGES),
      default: null,
    },
    at: { type: Date, required: true, default: Date.now },
    byUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: { type: String, default: '', maxlength: 500 },
  },
  { _id: false },
);

const candidateSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    requisitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobRequisition',
      required: true,
      index: true,
    },

    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    phone: { type: String, default: '', trim: true, maxlength: 30 },

    source: {
      type: String,
      enum: [
        'Referral',
        'JobBoard',
        'Agency',
        'Inbound',
        'Outbound',
        'Campus',
        'Unknown',
      ],
      default: 'Unknown',
      index: true,
    },
    referredByEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    resumeUrl: { type: String, default: '', maxlength: 500 },

    currentStage: {
      type: String,
      enum: Object.values(PIPELINE_STAGES),
      default: PIPELINE_STAGES.APPLIED,
      index: true,
    },
    /**
     * Append-only. Never rewritten in place — the timings the funnel and
     * time-to-hire are derived from live nowhere else.
     */
    stageHistory: { type: [stageHistorySchema], default: [] },

    appliedAt: { type: Date, required: true, default: Date.now },

    expectedCtc: { type: Number, default: null, min: 0 },
    offeredCtc: { type: Number, default: null, min: 0 },
    /** Snapshot of the band check at the moment the offer was made, so a later
     *  band amendment does not retroactively make a breach look compliant. */
    offerBandCheck: { type: mongoose.Schema.Types.Mixed, default: null },

    rejectionReason: { type: String, default: '', maxlength: 500 },

    /** Set when a hired candidate is converted into an employee record. */
    convertedEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One application per person per requisition. Reapplying to a *different* role
// is normal and must stay possible, so the index is on the pair rather than on
// the email alone.
candidateSchema.index(
  { tenantId: 1, requisitionId: 1, email: 1 },
  { unique: true },
);
candidateSchema.index({ tenantId: 1, currentStage: 1 });

const ratingSchema = new mongoose.Schema(
  {
    competency: { type: String, required: true, trim: true, maxlength: 80 },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 500 },
  },
  { _id: false },
);

const interviewFeedbackSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      index: true,
    },
    interviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    round: { type: String, required: true, trim: true, maxlength: 60 },
    interviewedOn: { type: Date, required: true, default: Date.now },

    ratings: { type: [ratingSchema], default: [] },
    recommendation: {
      type: String,
      enum: Object.values(RECOMMENDATIONS),
      required: true,
    },
    notes: { type: String, default: '', maxlength: 4000 },
  },
  { timestamps: true },
);

// One submission per interviewer per round. A second submission is an edit, and
// letting it become a second row would double-count that interviewer in the
// scorecard average and in the dissent calculation.
interviewFeedbackSchema.index(
  { candidateId: 1, interviewerId: 1, round: 1 },
  { unique: true },
);

jobRequisitionSchema.plugin(auditTrailPlugin);
candidateSchema.plugin(auditTrailPlugin);

const JobRequisition = mongoose.model('JobRequisition', jobRequisitionSchema);
const Candidate = mongoose.model('Candidate', candidateSchema);
const InterviewFeedback = mongoose.model(
  'InterviewFeedback',
  interviewFeedbackSchema,
);

module.exports = { JobRequisition, Candidate, InterviewFeedback };
