/**
 * Workflow Instance Model - Extended for Issue #1247
 *
 * One request travelling through a workflow, enhanced with:
 *   - Optimistic locking via __v (already present)
 *   - Stage locking: lockedBy / lockedAt / lockExpiresAt
 *   - Escalation: escalationDeadlineAt, escalatedAt
 *   - Detailed stageLog: timestamps + actor + comment + action per stage
 *
 * History is append-only by convention. A completed instance cannot be
 * rejected afterwards.
 */
const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const {
  ALL_INSTANCE_STATUSES,
  ALL_WORKFLOW_ACTIONS,
  ALL_TARGET_ENTITY_TYPES,
  INSTANCE_STATUS,
} = require('../config/workflow');

const workflowInstanceSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
    },

    targetEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetEntityType: {
      type: String,
      enum: ALL_TARGET_ENTITY_TYPES,
      required: true,
    },

    /** The node the request is standing at. Always an id from the graph. */
    currentNodeId: { type: String, required: true },

    history: [
      {
        _id: false,
        nodeId: String,
        actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        action: { type: String, enum: ALL_WORKFLOW_ACTIONS },
        comment: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    /**
     * Detailed stage log: each entry records who acted, what they did,
     * when, and any comment. This is the audit trail for compliance.
     */
    stageLog: [
      {
        _id: false,
        stageIndex: { type: Number, required: true },
        stageName: { type: String, required: true },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        action: { type: String, enum: ['pending', 'locked', 'approved', 'rejected', 'escalated'] },
        comment: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    status: {
      type: String,
      enum: ALL_INSTANCE_STATUSES,
      default: INSTANCE_STATUS.PENDING,
    },

    /** Who raised the request. */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },

    // ─── Stage Locking ────────────────────────────────────────────────────
    // Prevents two approvers from acting on the same stage simultaneously.
    // The lock auto-expires after lockTTLMs (default 10 minutes).
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lockExpiresAt: {
      type: Date,
      default: null,
    },

    // ─── Escalation ───────────────────────────────────────────────────────
    // When the current stage's approver hasn't acted by this deadline,
    // the escalation job auto-escalates to the next approver in the chain.
    escalationDeadlineAt: {
      type: Date,
      default: null,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    escalationNotifiedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],

    // ─── Stage Chain Snapshot ─────────────────────────────────────────────
    // Captures the workflow sequence at creation time so the frontend
    // can render the full chain even after the instance advances.
    stageChain: [{
      _id: false,
      stageIndex: Number,
      roleName: String,
      status: {
        type: String,
        enum: ['pending', 'active', 'approved', 'rejected', 'escalated'],
        default: 'pending',
      },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      actedAt: { type: Date, default: null },
      comment: { type: String, default: '' },
    }],

    /** Lock TTL in milliseconds. Default 10 minutes. */
    lockTTLMs: {
      type: Number,
      default: 10 * 60 * 1000,
    },
  },
  { timestamps: true },
);

// Indexes
workflowInstanceSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
workflowInstanceSchema.index({
  tenantId: 1,
  targetEntityType: 1,
  targetEntityId: 1,
});
// For the escalation job: find instances past their deadline that haven't
// been escalated yet.
workflowInstanceSchema.index({
  status: 'in_progress',
  escalationDeadlineAt: 1,
  escalatedAt: 1,
});

workflowInstanceSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('WorkflowInstance', workflowInstanceSchema);
