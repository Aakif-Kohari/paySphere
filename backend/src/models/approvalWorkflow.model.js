const mongoose = require('mongoose');

const approvalWorkflowSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sequence: [{ type: String, required: true }], // e.g. ['HR', 'Finance', 'CFO']
    isActive: { type: Boolean, default: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null }
  },
  { timestamps: true }
);

approvalWorkflowSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);
