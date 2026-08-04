const mongoose = require('mongoose');

const workflowInstanceSchema = new mongoose.Schema({
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  targetEntityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetEntityType: { type: String, enum: ['Payroll', 'Loan', 'Employee'], required: true },
  currentNodeId: { type: String, required: true },
  history: [{
    nodeId: String,
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: String,
    timestamp: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
}, { timestamps: true });

module.exports = mongoose.model('WorkflowInstance', workflowInstanceSchema);
