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
