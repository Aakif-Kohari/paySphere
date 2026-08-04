const mongoose = require('mongoose');

const workflowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nodes: [{
    id: { type: String, required: true },
    type: { type: String, enum: ['trigger', 'approval', 'condition', 'action'], required: true },
    data: { type: mongoose.Schema.Types.Mixed }
  }],
  edges: [{
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    label: { type: String }
  }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
}, { timestamps: true });

module.exports = mongoose.model('Workflow', workflowSchema);
