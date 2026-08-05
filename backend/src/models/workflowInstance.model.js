const mongoose = require('mongoose');
const {
  ALL_INSTANCE_STATUSES,
  ALL_WORKFLOW_ACTIONS,
  ALL_TARGET_ENTITY_TYPES,
  INSTANCE_STATUS,
} = require('../config/workflow');

/**
 * One request travelling through a workflow (#590).
 *
 * `history` is the approval trail, so it is append-only by convention: the
 * controller pushes an entry on every transition and refuses to touch an
 * instance that has already reached a terminal state. #590 guarded neither,
 * which meant a completed instance could be rejected afterwards and both
 * entries would sit in the trail (#614).
 */
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
        // Enumerated rather than a free String: #590 recorded whatever the
        // request body contained, so the trail could hold actions the engine
        // does not have.
        action: { type: String, enum: ALL_WORKFLOW_ACTIONS },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    status: {
      type: String,
      enum: ALL_INSTANCE_STATUSES,
      default: INSTANCE_STATUS.PENDING,
    },

    /** Who raised the request. The audit fact; `tenantId` is the scope. */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
  },
  { timestamps: true },
);

// "This company's requests, optionally filtered by status, newest first."
workflowInstanceSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

// "Is there already a request open against this payroll run?"
workflowInstanceSchema.index({ tenantId: 1, targetEntityType: 1, targetEntityId: 1 });

module.exports = mongoose.model('WorkflowInstance', workflowInstanceSchema);
