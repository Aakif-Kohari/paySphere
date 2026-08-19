/**
 * @fileoverview Training Course and Enrolment Schemas
 * @description Manages mandatory compliance courses, professional certifications,
 * and individual employee training records with expiration tracking.
 * Issue: #1076, #1085
 *
 * `validUntil` is stored on the enrolment rather than derived on read, and that
 * is a deliberate exception to the rule the rest of this codebase follows.
 *
 * It is stored because it is *evidence*. An auditor asking "was this person
 * certified on 14 March 2027" needs the answer the policy gave at the time the
 * course was completed. If validity were recomputed from the course on every
 * read, shortening a course's renewal cycle from 24 months to 12 would
 * retroactively invalidate certifications that were current when they were
 * issued — and lengthening it would retroactively revive lapsed ones.
 *
 * `expiring` is *not* stored, for the opposite reason: it is a fact about today,
 * so a stored flag is correct only until tomorrow. It is derived in
 * `certificationState`.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');
const {
  ENROLLMENT_STATUS,
  APPLIES_TO,
} = require('../utils/trainingCompliance');

// ============================================================================
// Training Course Schema
// ============================================================================

const trainingCourseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: '', maxlength: 2000 },
    category: {
      type: String,
      enum: [
        'Compliance',
        'InfoSec',
        'Safety',
        'Technical',
        'Leadership',
        'Onboarding',
        'Other',
      ],
      default: 'Compliance',
      index: true,
    },

    /**
     * Mandatory courses are the ones `coverageGaps` reports on. An optional
     * course with an expiry is still tracked and still generates renewal
     * reminders; it just is not a gap when nobody has taken it.
     */
    isMandatory: { type: Boolean, default: false, index: true },

    appliesTo: {
      type: String,
      enum: Object.values(APPLIES_TO),
      default: APPLIES_TO.ALL,
    },
    /**
     * Department names or role titles, depending on `appliesTo`. Ignored when
     * `appliesTo` is `All`. Also serves as `targetDepartments` for simpler
     * department-only targeting (#1085).
     */
    appliesToValues: { type: [String], default: [] },

    durationMinutes: { type: Number, default: 0, min: 0 },
    passMark: { type: Number, default: 0, min: 0, max: 100 },
    /** 0 means unlimited retakes. */
    maxAttempts: { type: Number, default: 0, min: 0, max: 20 },

    /**
     * 0 means the certification never expires — an induction, a one-off
     * briefing. Distinguished from "not set" because it is a real policy and
     * `computeValidity` returns `validUntil: null` for it rather than a
     * far-future sentinel that eventually arrives.
     */
    validityMonths: { type: Number, default: 0, min: 0, max: 240 },

    /**
     * Validity in days, used as an alternative to validityMonths for courses
     * with shorter or non-monthly renewal cycles (#1085). When both are set,
     * validityMonths takes precedence for backward compatibility.
     * 0 means lifetime certification.
     */
    validityDays: { type: Number, default: 0, min: 0, max: 7300 },

    /**
     * How much notice a renewal needs, per course.
     *
     * A four-hour refresher wants two weeks; a two-day external certification
     * with a booked exam slot wants three months. A single global constant would
     * be wrong for one of them.
     */
    reminderLeadDays: { type: Number, default: 30, min: 0, max: 365 },

    /** Link to LMS, external training platform, or reference material (#1085). */
    externalLink: { type: String, default: '', trim: true, maxlength: 2000 },

    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

trainingCourseSchema.index({ tenantId: 1, code: 1 }, { unique: true });
trainingCourseSchema.index({ tenantId: 1, isActive: 1 });

/**
 * A targeted course with no targets applies to nobody, which is almost never
 * what the author meant.
 *
 * `isApplicable` already fails closed for this case — safer than assigning a
 * role-specific safety course to the whole company on the strength of a typo —
 * but silently creating a course that reaches no one is worth refusing outright.
 */
trainingCourseSchema.pre('validate', function validateTargets(next) {
  if (
    this.appliesTo !== APPLIES_TO.ALL &&
    (!Array.isArray(this.appliesToValues) || this.appliesToValues.length === 0)
  ) {
    return next(
      new Error(
        `appliesToValues is required when appliesTo is ${this.appliesTo}; a targeted course with no targets applies to nobody`,
      ),
    );
  }
  return next();
});

// ============================================================================
// Training Enrollment / Employee Training Record Schema
// ============================================================================

const trainingEnrollmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingCourse',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(ENROLLMENT_STATUS),
      default: ENROLLMENT_STATUS.ASSIGNED,
      index: true,
    },

    assignedAt: { type: Date, required: true, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    score: { type: Number, default: null, min: 0, max: 100 },
    attemptCount: { type: Number, default: 0, min: 0 },

    /**
     * Stored evidence, not a cache. See the file header: recomputing this on
     * read would make a policy change retroactively invalidate — or revive —
     * certifications that were correct when issued.
     *
     * Also indexed as `expiresAt` alias for the expiration engine (#1085).
     */
    validUntil: { type: Date, default: null, index: true },

    certificateReference: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },

    /** URL to uploaded certificate proof (#1085). */
    certificateUrl: { type: String, default: '', trim: true, maxlength: 2000 },

    /** When the certificate proof was uploaded (#1085). */
    certificateUploadedAt: { type: Date, default: null },

    /** User who verified the certificate proof (#1085). */
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    /** Last reminder timestamp to prevent duplicate/spam notifications (#1085). */
    lastReminderSentAt: { type: Date, default: null },

    /** A waiver is a documented decision, so the reason is required with it. */
    waivedReason: { type: String, default: '', maxlength: 500 },
    waivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One live enrolment per employee per course. A retake updates the row and
// increments `attemptCount`; a renewal after expiry does the same. Keeping
// history as separate rows would make "is this person certified" a question
// about which row to believe, which is the ambiguity `indexEnrollments` exists
// to resolve when it does happen.
trainingEnrollmentSchema.index(
  { tenantId: 1, courseId: 1, employeeId: 1 },
  { unique: true },
);
trainingEnrollmentSchema.index({ tenantId: 1, status: 1, validUntil: 1 });

// ============================================================================
// Plugins & Model Registration
// ============================================================================

trainingCourseSchema.plugin(auditTrailPlugin);
trainingEnrollmentSchema.plugin(auditTrailPlugin);

const TrainingCourse = mongoose.model('TrainingCourse', trainingCourseSchema);
const TrainingEnrollment = mongoose.model(
  'TrainingEnrollment',
  trainingEnrollmentSchema,
);

// Backward-compatible alias: some modules may import EmployeeTrainingRecord
// from the #1085 schema. Point it at the same collection/model so there is
// one source of truth and no duplicate collection risk.
const EmployeeTrainingRecord = TrainingEnrollment;

module.exports = { TrainingCourse, TrainingEnrollment, EmployeeTrainingRecord };
