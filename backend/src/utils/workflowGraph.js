const { NODE_TYPE } = require('../config/workflow');
const ASTEvaluator = require('../services/astEvaluator.service');

/**
 * The graph rules a workflow has to satisfy, and the questions a transition has
 * to ask before it moves an instance (#614, repaired again in #894).
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
 *
 * ── #894 ───────────────────────────────────────────────────────────────────
 *
 * Conditional edges were merged into this file by pasting a new `hasEdge` and
 * `nextNodesFrom` over the originals, and the paste brought its own require
 * block with it. `const { NODE_TYPE } = require(...)` therefore appeared twice
 * in one module scope, which is a `SyntaxError`, which meant `workflow.routes`
 * could not be required, which meant `app.js` could not be required. The whole
 * API was down — not just the workflow endpoints.
 *
 * The requires are consolidated at the top of the file now, which is the only
 * place a require belongs and the only arrangement in which a second copy is
 * obvious rather than 120 lines away.
 *
 * The duplicate hid a second bug. `hasEdge`/`nextNodesFrom` grew an
 * `entityContext` parameter for evaluating edge conditions, but `isTerminalNode`
 * had no such parameter and called `nextNodesFrom` without one. An `Identifier`
 * resolved against `{}` is `undefined`, so `amount >= 50000` evaluated to
 * `Number(undefined) >= 50000` — `false` — for every conditional edge, which
 * made every conditional edge invisible. Two consequences, and the second is
 * the expensive one:
 *
 *   1. `approve` along a conditional edge answered 400 "no step from x to y"
 *      for an edge that is right there in the definition, stranding the run.
 *   2. `isTerminalNode` returned `true` for any node whose outgoing edges were
 *      all conditional, so `approve_final` was accepted mid-chain and the
 *      instance completed with the remaining approvers never seeing it. That is
 *      the #614 bug — completing a chain early — reintroduced by a merge.
 *
 * `entityContext` is threaded through all three functions below, and the
 * controller builds one from the instance's target entity.
 */

/** Operators `ASTEvaluator.evaluate` knows how to apply to a BinaryExpression. */
const SUPPORTED_OPERATORS = [
  '==',
  '===',
  '!=',
  '!==',
  '>',
  '<',
  '>=',
  '<=',
  'in',
  'contains',
];

/**
 * Does this edge carry a condition at all?
 *
 * `condition` and `rule` are both accepted because the builder UI writes the
 * first and the seeded definitions use the second.
 *
 * @param {object} edge
 * @returns {object|string|undefined} the rule, or undefined for a plain edge
 */
function conditionOf(edge) {
  return edge?.condition || edge?.rule || undefined;
}

/**
 * Is this something `ASTEvaluator.evaluateRule` can actually act on?
 *
 * Worth its own function because `evaluateRule` is deliberately forgiving: it
 * returns `true` for anything it does not recognise, on the reasoning that an
 * absent condition should not block a transition. That is the right default at
 * evaluation time and the wrong one at save time — it means a typo'd operator
 * is accepted into a stored definition and then quietly changes the behaviour
 * of the chain. `validateGraph` uses this to reject it at the door instead.
 *
 * @param {unknown} rule
 * @returns {boolean}
 */
function isEvaluableCondition(rule) {
  if (rule === undefined || rule === null) return true;
  if (typeof rule !== 'object' || Array.isArray(rule)) return false;

  // A raw AST node. `evaluate` walks it and warns on an unknown `type`, so the
  // only thing checkable up front is that it has one.
  if (typeof rule.type === 'string' && rule.type.trim() !== '') return true;

  // The shorthand form: { field, operator, value }.
  if (typeof rule.field !== 'string' || rule.field.trim() === '') return false;
  if (!SUPPORTED_OPERATORS.includes(rule.operator)) return false;

  return true;
}

/**
 * Evaluate an edge's condition against the entity the run is about.
 *
 * A plain edge — no condition — is always traversable, which is what makes the
 * conditional support backwards compatible with every workflow defined before
 * it existed.
 *
 * @param {object} edge
 * @param {object} entityContext
 * @returns {boolean}
 */
function edgeIsOpen(edge, entityContext) {
  const rule = conditionOf(edge);
  if (rule === undefined) return true;

  return Boolean(ASTEvaluator.evaluateRule(rule, entityContext || {}));
}

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

  const missingIds = ids.filter(
    (id) => typeof id !== 'string' || id.trim() === '',
  );
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
      errors.push(
        `Edge "${edge?.id}" starts at unknown node "${edge?.source}"`,
      );
    }
    if (!seen.has(edge?.target)) {
      errors.push(`Edge "${edge?.id}" ends at unknown node "${edge?.target}"`);
    }

    // Checked here because there is nowhere later that it *can* be checked. A
    // rule `evaluateRule` does not recognise evaluates to `true` at every
    // transition, so a workflow saved with a typo'd operator does not fail —
    // it silently becomes an unconditional edge, and the branch the author
    // wrote is never enforced. The only moment this is visible is at save time.
    if (!isEvaluableCondition(conditionOf(edge))) {
      errors.push(
        `Edge "${edge?.id}" has a condition that cannot be evaluated: a condition needs either an AST "type", or a "field" and an "operator" from ${SUPPORTED_OPERATORS.join(', ')}`,
      );
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
 * Is there an edge from `source` to `target` that is open right now?
 *
 * This is what makes the chain a chain. Without it, `transitionInstance` will
 * move an instance from the first approval straight to the last one.
 *
 * "Open right now" rather than "exists": an edge carrying a condition is only
 * traversable when that condition holds for the entity the run is about, which
 * is what `entityContext` is for. Omitting the context does not mean "ignore
 * conditions" — it means every condition is evaluated against nothing and
 * therefore fails, so callers must pass one. See the file header.
 *
 * @param {{edges?: object[]}} graph
 * @param {string} source
 * @param {string} target
 * @param {object} [entityContext={}] the entity the instance was raised against
 * @returns {boolean}
 */
function hasEdge(graph, source, target, entityContext = {}) {
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  return edges.some(
    (e) =>
      e?.source === source &&
      e?.target === target &&
      edgeIsOpen(e, entityContext),
  );
}

/**
 * The nodes reachable in one step from `nodeId`.
 *
 * @param {{nodes?: object[], edges?: object[]}} graph
 * @param {string} nodeId
 * @param {object} [entityContext={}] the entity the instance was raised against
 * @returns {string[]}
 */
function nextNodesFrom(graph, nodeId, entityContext = {}) {
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  return edges
    .filter((e) => e?.source === nodeId && edgeIsOpen(e, entityContext))
    .map((e) => e.target);
}

/**
 * Every node reachable in one step, ignoring conditions.
 *
 * The difference between this and `nextNodesFrom` is the whole of #894: a node
 * with one conditional outgoing edge has no *open* next nodes when the
 * condition does not hold, but it is not the end of the chain. `isTerminalNode`
 * needs this list, not the open one — otherwise a run whose condition happens
 * to be false today can be signed off as complete.
 *
 * Also useful in an error response: telling a caller "there is a step to
 * `finance`, but its condition does not hold for this record" is a far more
 * actionable 400 than an empty list.
 *
 * @param {{edges?: object[]}} graph
 * @param {string} nodeId
 * @returns {string[]}
 */
function allNextNodesFrom(graph, nodeId) {
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  return edges.filter((e) => e?.source === nodeId).map((e) => e.target);
}

/**
 * Is `nodeId` the end of the chain — nothing leads out of it?
 *
 * Used to check that `approve_final` is only sent at a node that really is
 * final, so a run cannot be completed three steps early.
 *
 * Deliberately asks whether any edge *leaves* the node, not whether any edge is
 * currently open. A node whose single outgoing edge is gated on
 * `amount >= 50000` is a mid-chain node for a £200 expense just as much as for
 * a £2m one; the condition decides which way the run goes, not whether the run
 * is over. Answering "terminal" here is what let `approve_final` complete a
 * chain from its second step.
 *
 * @param {{nodes?: object[], edges?: object[]}} graph
 * @param {string} nodeId
 * @returns {boolean}
 */
function isTerminalNode(graph, nodeId) {
  return allNextNodesFrom(graph, nodeId).length === 0;
}

module.exports = {
  validateGraph,
  findTriggerNode,
  hasNode,
  hasEdge,
  nextNodesFrom,
  allNextNodesFrom,
  isTerminalNode,
  isEvaluableCondition,
  conditionOf,
  SUPPORTED_OPERATORS,
};
