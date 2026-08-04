const fs = require('fs');
const path = require('path');

const write = (fPath, content) => {
  fs.mkdirSync(path.dirname(fPath), { recursive: true });
  fs.writeFileSync(fPath, content.trim() + '\n');
};

// 1. Workflow Models
write(path.join(__dirname, 'src', 'models', 'workflow.model.js'), `
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
`);

write(path.join(__dirname, 'src', 'models', 'workflowInstance.model.js'), `
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
`);

// 2. Workflow Controller
write(path.join(__dirname, 'src', 'controllers', 'workflow.controller.js'), `
const Workflow = require('../models/workflow.model');
const WorkflowInstance = require('../models/workflowInstance.model');

exports.createWorkflow = async (req, res) => {
  try {
    const workflow = new Workflow({ ...req.body, tenantId: req.tenantId });
    await workflow.save();
    res.status(201).json({ success: true, workflow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getWorkflows = async (req, res) => {
  try {
    const workflows = await Workflow.find({ tenantId: req.tenantId });
    res.status(200).json({ success: true, workflows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.transitionInstance = async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { action, nextNodeId } = req.body;
    
    const instance = await WorkflowInstance.findOne({ _id: instanceId, tenantId: req.tenantId });
    if (!instance) return res.status(404).json({ success: false, message: 'Instance not found' });
    
    instance.history.push({
      nodeId: instance.currentNodeId,
      actionBy: req.userId,
      action
    });
    
    instance.currentNodeId = nextNodeId;
    if (action === 'approve_final') instance.status = 'completed';
    if (action === 'reject') instance.status = 'rejected';
    
    await instance.save();
    res.status(200).json({ success: true, instance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
`);

// 3. Workflow Routes
write(path.join(__dirname, 'src', 'routes', 'workflow.routes.js'), `
const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflow.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.post('/', workflowController.createWorkflow);
router.get('/', workflowController.getWorkflows);
router.post('/:instanceId/transition', workflowController.transitionInstance);

module.exports = router;
`);

// 4. Update app.js
const appFile = path.join(__dirname, 'src', 'app.js');
let appContent = fs.readFileSync(appFile, 'utf8');
if (!appContent.includes('/api/workflows')) {
  appContent = appContent.replace(
    /app\.use\('\/api\/users', require\('\.\/routes\/user\.routes'\)\);/,
    `app.use('/api/users', require('./routes/user.routes'));\napp.use('/api/workflows', require('./routes/workflow.routes'));`
  );
  fs.writeFileSync(appFile, appContent);
}

// 5. Frontend WorkflowBuilder (Mock)
const frontendApp = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'WorkflowBuilder.jsx');
write(frontendApp, `
import React, { useState } from 'react';

export default function WorkflowBuilder() {
  const [nodes, setNodes] = useState([]);
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Workflow Builder</h1>
      <div className="border-4 border-dashed border-gray-300 rounded-xl h-96 flex items-center justify-center text-gray-500">
        Drag and drop approval nodes here (React Flow integration pending)
      </div>
    </div>
  );
}
`);
console.log('Workflow Engine applied successfully.');
