const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const { ALL_NODE_TYPES } = require('../config/workflow');

/**
 * A workflow definition — the approval chain, as a graph (#590).
 *
 * The schema can say "a node has an id and a type". It cannot say "every edge
 * points at a node that exists" or "there is exactly one trigger", which are
 * the rules that make the graph runnable. Those live in utils/workflowGraph.js
 * and are enforced by the controller before a definition is saved (#614).
 */
const workflowSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Workflow name cannot exceed 200 characters'],
    },

    nodes: [
      {
        _id: false,
        id: { type: String, required: true },
        type: { type: String, enum: ALL_NODE_TYPES, required: true },
        data: { type: mongoose.Schema.Types.Mixed },
      },
    ],

    edges: [
      {
        _id: false,
        id: { type: String, required: true },
        source: { type: String, required: true },
        target: { type: String, required: true },
        label: { type: String },
      },
    ],

    /** Who defined the chain. The audit fact; `tenantId` is the scope. */
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

// The list read is "this company's workflows, newest first" — the only query
// the controller runs against this collection.
workflowSchema.index({ tenantId: 1, createdAt: -1 });

workflowSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Workflow', workflowSchema);
