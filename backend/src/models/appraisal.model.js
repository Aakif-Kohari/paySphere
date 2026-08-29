/**
 * @fileoverview Performance Appraisal & Goal Tracking Schemas
 * @description Manages appraisal cycles, KRA/KPI goals, self-reviews, and manager reviews.
 * Implements a state-machine workflow: Draft -> Self-Review -> Manager-Review -> Finalized.
 * Issue: #983
 */
const mongoose = require('mongoose');

/**
 * Appraisal Cycle Schema
 * Defines the review period (e.g., "H1 2026", "Annual 2025-26") and its current state.
 */
const appraisalCycleSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true }, // e.g., "Annual Review 2025-26"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Draft', 'Active', 'Completed', 'Archived'],
      default: 'Draft',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // --- Calibration settings (#1158) ---------------------------------------
    //
    // Stored on the cycle rather than read from a constant at calibration time.
    // A cycle calibrated against a 10/20/40/20/10 spread has to keep reporting
    // against that spread after the company changes its policy — a distribution
    // that moves under a finalised cycle rewrites what people were told.
    targetDistribution: [
      {
        _id: false,
        band: { type: String, required: true },
        targetPercent: { type: Number, required: true, min: 0, max: 100 },
        minScore: { type: Number, default: 0, min: 0, max: 100 },
        incrementPercent: { type: Number, default: 0, min: 0, max: 100 },
      },
    ],
    /** The annual envelope increments were fitted to, where one was set. */
    incrementBudget: { type: Number, default: null, min: 0 },
    calibratedAt: { type: Date, default: null },
    calibratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

appraisalCycleSchema.index({ tenantId: 1, status: 1 });
const AppraisalCycle = mongoose.model('AppraisalCycle', appraisalCycleSchema);

/**
 * Appraisal Goal Schema
 * Tracks individual KRA/KPI completion percentages for an employee within a cycle.
 */
const appraisalGoalSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AppraisalCycle',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true }, // e.g., "Increase API throughput by 20%"
    description: { type: String, default: '' },
    weightage: { type: Number, required: true, min: 1, max: 100 }, // Percentage weight of this goal
    targetMetric: { type: String, default: '' }, // e.g., "ms", "%", "count"
    selfAchievement: { type: Number, default: 0, min: 0, max: 100 }, // Employee's self-rated %
    managerAchievement: { type: Number, default: 0, min: 0, max: 100 }, // Manager's rated %
    selfRemarks: { type: String, default: '' },
    managerRemarks: { type: String, default: '' },
  },
  { timestamps: true },
);

appraisalGoalSchema.index({ cycleId: 1, employeeId: 1 });
const AppraisalGoal = mongoose.model('AppraisalGoal', appraisalGoalSchema);

/**
 * Appraisal Review Schema
 * The overall review document tracking the state machine and final scores.
 */
const appraisalReviewSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AppraisalCycle',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    }, // The reviewing manager

    // State Machine: Draft -> Self-Review -> Manager-Review -> Finalized
    status: {
      type: String,
      enum: ['Draft', 'Self-Review', 'Manager-Review', 'Finalized'],
      default: 'Draft',
      index: true,
    },

    // Qualitative Manager Rating (out of 5 or 10, configurable, assuming 5 here)
    managerOverallRating: { type: Number, default: 0, min: 0, max: 5 },
    managerQualitativeFeedback: { type: String, default: '' },

    // Calculated Final Score (0-100)
    finalScore: { type: Number, default: 0, min: 0, max: 100 },

    // Recommended Increment % (linked to Salary Revision engine)
    recommendedIncrementPercent: { type: Number, default: 0, min: 0, max: 100 },

    finalizedAt: { type: Date, default: null },

    // --- Calibration outcome (#1158) ----------------------------------------
    //
    // `finalScore` above is deliberately left as the manager wrote it. A
    // calibration that overwrote it would destroy the only record of what the
    // manager actually assessed, and an employee asking why their rating moved
    // could not be shown the two numbers side by side.
    normalizedScore: { type: Number, default: null, min: 0, max: 100 },
    /** The band the forced distribution placed this review in. */
    calibrationBand: { type: String, default: null },
    /**
     * The increment after the budget fit — as opposed to
     * `recommendedIncrementPercent`, which is what the score alone suggested
     * before anyone checked what the cycle cost.
     */
    approvedIncrementPercent: { type: Number, default: null, min: 0, max: 100 },
    calibratedAt: { type: Date, default: null },
    calibratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

// Ensure one review per employee per cycle
appraisalReviewSchema.index({ cycleId: 1, employeeId: 1 }, { unique: true });
const AppraisalReview = mongoose.model(
  'AppraisalReview',
  appraisalReviewSchema,
);

module.exports = { AppraisalCycle, AppraisalGoal, AppraisalReview };
