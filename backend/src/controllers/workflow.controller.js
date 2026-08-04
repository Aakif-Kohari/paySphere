const mongoose = require('mongoose');
const Workflow = require('../models/workflow.model');
const WorkflowInstance = require('../models/workflowInstance.model');
const logger = require('../utils/logger');
const eventBus = require('../services/event.service');
const {
  WORKFLOW_ACTION,
  ALL_WORKFLOW_ACTIONS,
  INSTANCE_STATUS,
  ALL_TARGET_ENTITY_TYPES,
  isTerminal,
  statusAfter,
} = require('../config/workflow');
const {
  validateGraph,
  findTriggerNode,
  hasNode,
  hasEdge,
  nextNodesFrom,
  isTerminalNode,
} = require('../utils/workflowGraph');

/**
 * The multi-step approval engine from #590, made reachable and made to enforce
 * its own graph (#614).
 *
 * Three things were wrong with the original. The router was never mounted, so
 * none of this ran. `transitionInstance` trusted `nextNodeId` off the request
 * body without checking it against the workflow, so the chain could be skipped
 * and an instance could be stranded on a node that does not exist. And there
 * was no way to create an instance at all — `WorkflowInstance` documents were
 * only ever read, by a handler that could only be reached if one already
 * existed.
 */

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/**
 * The tenant this request is scoped to, or null.
 *
 * An undefined tenant is not a filter that matches nothing: the driver drops
 * the key when it encodes the query, so `find({ tenantId: undefined })` returns
 * every company's workflows. Every handler below refuses rather than querying.
 * See #612 for the full account of that failure mode.
 *
 * @param {object} req
 * @returns {string|null}
 */
function scopeOf(req) {
  const tenantId = req?.tenantId;
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) return null;

  return tenantId;
}

/** 403 for an unscoped request. */
function refuseUnscoped(res) {
  return res.status(403).json({
    message:
      'Your account is not linked to a company yet. Sign in again to continue.',
  });
}

/**
 * POST /api/workflows — define an approval chain.
 */
exports.createWorkflow = async (req, res, next) => {
  try {
    const tenantId = scopeOf(req);
    if (!tenantId) return refuseUnscoped(res);

    const { name, nodes, edges } = req.body || {};

    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'A workflow needs a name' });
    }

    // Validated here rather than left to the schema, because the interesting
    // rules are relationships between nodes and edges — "every edge points at a
    // node that exists", "exactly one trigger" — which a per-field schema
    // cannot express. #590 validated none of them, so a graph with dangling
    // edges saved cleanly and only failed later, when an instance ran into one.
    const graphErrors = validateGraph({ nodes, edges });
    if (graphErrors.length > 0) {
      return res.status(400).json({
        message: 'Invalid workflow definition',
        errors: graphErrors,
      });
    }

    const workflow = await Workflow.create({
      name: name.trim(),
      nodes,
      edges: edges || [],
      createdBy: req.userId,
      tenantId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WORKFLOW_CREATE',
      resourceType: 'Workflow',
      resourceIds: [workflow._id],
      details: { name: workflow.name, nodeCount: nodes.length },
      req,
    });

    return res.status(201).json({ success: true, workflow });
  } catch (error) {
    // Handed to error.middleware rather than returned as a 500 with
    // `err.message` in the body, which is what #590 did — that leaks raw
    // mongoose text to the client and disagrees with every other handler.
    return next(error);
  }
};

/**
 * GET /api/workflows — the company's workflow definitions.
 */
exports.getWorkflows = async (req, res, next) => {
  try {
    const tenantId = scopeOf(req);
    if (!tenantId) return refuseUnscoped(res);

    let page = parseInt(req.query?.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query?.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      limit = DEFAULT_PAGE_SIZE;
    }

    const query = { tenantId };

    const [workflows, totalCount] = await Promise.all([
      Workflow.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Workflow.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      workflows,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 0,
      totalCount,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/workflows/:workflowId/instances — raise a request against a chain.
 *
 * The handler #590 was missing entirely. Without it `WorkflowInstance` was a
 * collection nothing wrote to, and `transitionInstance` could only ever answer
 * 404.
 */
exports.startInstance = async (req, res, next) => {
  try {
    const tenantId = scopeOf(req);
    if (!tenantId) return refuseUnscoped(res);

    const { workflowId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
      return res.status(400).json({ message: 'Invalid workflow id format' });
    }

    const { targetEntityId, targetEntityType } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(targetEntityId)) {
      return res.status(400).json({ message: 'Invalid target entity id format' });
    }

    if (!ALL_TARGET_ENTITY_TYPES.includes(targetEntityType)) {
      return res.status(400).json({
        message: `targetEntityType must be one of: ${ALL_TARGET_ENTITY_TYPES.join(', ')}`,
      });
    }

    const workflow = await Workflow.findOne({ _id: workflowId, tenantId });
    if (!workflow) {
      // Indistinguishable from "does not exist", so a caller cannot probe for
      // another company's workflow ids.
      return res.status(404).json({ message: 'Workflow not found' });
    }

    const trigger = findTriggerNode(workflow);
    if (!trigger) {
      return res.status(400).json({
        message: 'This workflow has no trigger node and cannot be started',
      });
    }

    const instance = await WorkflowInstance.create({
      workflowId: workflow._id,
      targetEntityId,
      targetEntityType,
      currentNodeId: trigger.id,
      status: INSTANCE_STATUS.PENDING,
      history: [],
      createdBy: req.userId,
      tenantId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WORKFLOW_INSTANCE_START',
      resourceType: 'WorkflowInstance',
      resourceIds: [instance._id],
      details: { workflowId: String(workflow._id), targetEntityType },
      req,
    });

    return res.status(201).json({ success: true, instance });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/workflows/instances — the company's open and closed requests.
 */
exports.getInstances = async (req, res, next) => {
  try {
    const tenantId = scopeOf(req);
    if (!tenantId) return refuseUnscoped(res);

    let page = parseInt(req.query?.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query?.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      limit = DEFAULT_PAGE_SIZE;
    }

    const query = { tenantId };

    if (req.query?.status) {
      if (!Object.values(INSTANCE_STATUS).includes(req.query.status)) {
        return res.status(400).json({ message: 'Invalid status filter' });
      }
      query.status = req.query.status;
    }

    const [instances, totalCount] = await Promise.all([
      WorkflowInstance.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      WorkflowInstance.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      instances,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit) || 0,
      totalCount,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/workflows/instances/:instanceId/transition — act on a request.
 *
 * Every check below was absent in #590. The handler took `action` and
 * `nextNodeId` off the body, wrote both, and saved.
 */
exports.transitionInstance = async (req, res, next) => {
  try {
    const tenantId = scopeOf(req);
    if (!tenantId) return refuseUnscoped(res);

    const { instanceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(instanceId)) {
      return res.status(400).json({ message: 'Invalid instance id format' });
    }

    const { action, nextNodeId } = req.body || {};

    if (!ALL_WORKFLOW_ACTIONS.includes(action)) {
      return res.status(400).json({
        message: `action must be one of: ${ALL_WORKFLOW_ACTIONS.join(', ')}`,
      });
    }

    const instance = await WorkflowInstance.findOne({ _id: instanceId, tenantId });
    if (!instance) {
      return res.status(404).json({ message: 'Instance not found' });
    }

    // An approval trail that can be rewritten after the fact is not an approval
    // trail. #590 let a completed instance be rejected, and appended both
    // entries to its history.
    if (isTerminal(instance.status)) {
      return res.status(409).json({
        message: `This request is already ${instance.status} and cannot be changed`,
        status: instance.status,
      });
    }

    const workflow = await Workflow.findOne({ _id: instance.workflowId, tenantId });
    if (!workflow) {
      logger.error('Workflow instance points at a workflow that is gone', {
        instanceId: String(instance._id),
        workflowId: String(instance.workflowId),
      });
      return res.status(409).json({
        message: 'The workflow this request belongs to no longer exists',
      });
    }

    const fromNodeId = instance.currentNodeId;

    // Rejecting ends the chain wherever it is standing, so it needs no target.
    // Approving has to move somewhere real, along an edge that exists.
    if (action === WORKFLOW_ACTION.APPROVE_FINAL) {
      // Completing three steps early is the same bug as skipping them.
      if (!isTerminalNode(workflow, fromNodeId)) {
        return res.status(400).json({
          message:
            'This is not the final step — use "approve" to move to the next one',
          nextNodes: nextNodesFrom(workflow, fromNodeId),
        });
      }
    } else if (action === WORKFLOW_ACTION.APPROVE) {
      if (!hasNode(workflow, nextNodeId)) {
        // #590 wrote this id straight onto the instance, which stranded it on a
        // node no participant could ever be standing at.
        return res.status(400).json({
          message: `"${nextNodeId}" is not a node in this workflow`,
          nextNodes: nextNodesFrom(workflow, fromNodeId),
        });
      }

      if (!hasEdge(workflow, fromNodeId, nextNodeId)) {
        // The check that makes a multi-step chain multi-step.
        return res.status(400).json({
          message: `This workflow has no step from "${fromNodeId}" to "${nextNodeId}"`,
          nextNodes: nextNodesFrom(workflow, fromNodeId),
        });
      }
    }

    instance.history.push({
      nodeId: fromNodeId,
      actionBy: req.userId,
      action,
      timestamp: new Date(),
    });

    if (action === WORKFLOW_ACTION.APPROVE) {
      instance.currentNodeId = nextNodeId;
    }
    instance.status = statusAfter(action);

    await instance.save();

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'WORKFLOW_TRANSITION',
      resourceType: 'WorkflowInstance',
      resourceIds: [instance._id],
      details: {
        workflowAction: action,
        fromNodeId,
        toNodeId: instance.currentNodeId,
        status: instance.status,
      },
      req,
    });

    return res.status(200).json({ success: true, instance });
  } catch (error) {
    return next(error);
  }
};
