const { NODE_TYPE } = require('../config/workflow');

/**
 * The graph rules a workflow has to satisfy, and the questions a transition has
 * to ask before it moves an instance (#614).
 *
 * `#590` shipped a workflow *shape* — nodes and edges on a schema — and a
 * transition handler that consulted neither:
 *
 *     instance.currentNodeId = nextNodeId;
 *     await instance.save();
 *
 * `nextNodeId` came straight off the request body. It was never checked against
 * the workflow's own nodes, so a caller could park an instance on a node id
 * that does not exist and strand it permanently; and no edge was checked, so
 * any node could jump to any other node. A multi-step approval chain whose
 * steps can be skipped is decorative — the whole value of the feature is that
 * step two is unreachable without step one.
 *
 * Pure functions, no database, no request: the graph rules are the part most
 * worth testing directly, and they are the part #590 had none of.
 */

/**
 * Every problem with a workflow graph, as a list of human-readable strings.
 *
 * Returns all of them rather than the first, so a client fixing a definition in
 * the builder UI sees everything wrong with it in one response instead of
 * discovering the next problem on each save.
 *
 * @param {{nodes?: object[], edges?: object[]}} graph
 * @returns {string[]} empty when the graph is valid
 */
function validateGraph(graph) {
  const errors = [];
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  if (nodes.length === 0) {
    errors.push('A workflow needs at least one node');
    return errors;
  }

  const ids = nodes.map((n) => n?.id);

  const missingIds = ids.filter((id) => typeof id !== 'string' || id.trim() === '');
  if (missingIds.length > 0) {
    errors.push('Every node needs a non-empty id');
  }

  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (duplicates.size > 0) {
    // Two nodes with one id makes `currentNodeId` ambiguous: the instance is
    // sitting on one of them and there is no way to say which.
    errors.push(`Duplicate node ids: ${[...duplicates].join(', ')}`);
  }

  const triggers = nodes.filter((n) => n?.type === NODE_TYPE.TRIGGER);
  if (triggers.length === 0) {
    // Without one there is nowhere for a new instance to start.
    errors.push('A workflow needs exactly one trigger node, and has none');
  } else if (triggers.length > 1) {
    errors.push(
      `A workflow needs exactly one trigger node, and has ${triggers.length}`,
    );
  }

  for (const edge of edges) {
    if (!seen.has(edge?.source)) {
      errors.push(`Edge "${edge?.id}" starts at unknown node "${edge?.source}"`);
    }
    if (!seen.has(edge?.target)) {
      errors.push(`Edge "${edge?.id}" ends at unknown node "${edge?.target}"`);
    }
  }

  return errors;
}

/**
 * The node a new instance starts on.
 *
 * @param {{nodes?: object[]}} graph
 * @returns {object|null}
 */
function findTriggerNode(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];

  return nodes.find((n) => n?.type === NODE_TYPE.TRIGGER) || null;
}

/**
 * Does this graph contain a node with this id?
 *
 * @param {{nodes?: object[]}} graph
 * @param {string} nodeId
 * @returns {boolean}
 */
function hasNode(graph, nodeId) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];

  return nodes.some((n) => n?.id === nodeId);
}

/**
 * Is there an edge from `source` to `target`?
 *
 * This is what makes the chain a chain. Without it, `transitionInstance` will
 * move an instance from the first approval straight to the last one.
 *
 * @param {{edges?: object[]}} graph
 * @param {string} source
 * @param {string} target
 * @returns {boolean}
 */
function hasEdge(graph, source, target) {
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  return edges.some((e) => e?.source === source && e?.target === target);
}

/**
 * The nodes reachable in one step from `nodeId`.
 *
 * Returned on a rejected transition so the client can say "you can go to X or
 * Y from here" rather than only "no".
 *
 * @param {{nodes?: object[], edges?: object[]}} graph
 * @param {string} nodeId
 * @returns {string[]}
 */
function nextNodesFrom(graph, nodeId) {
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  return edges.filter((e) => e?.source === nodeId).map((e) => e.target);
}

/**
 * Is `nodeId` the end of the chain — nothing leads out of it?
 *
 * Used to check that `approve_final` is only sent at a node that really is
 * final, so a run cannot be completed three steps early.
 *
 * @param {{nodes?: object[], edges?: object[]}} graph
 * @param {string} nodeId
 * @returns {boolean}
 */
function isTerminalNode(graph, nodeId) {
  return nextNodesFrom(graph, nodeId).length === 0;
}

module.exports = {
  validateGraph,
  findTriggerNode,
  hasNode,
  hasEdge,
  nextNodesFrom,
  isTerminalNode,
};
