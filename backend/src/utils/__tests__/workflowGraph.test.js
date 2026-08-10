const {
  validateGraph,
  findTriggerNode,
  hasNode,
  hasEdge,
  nextNodesFrom,
  isTerminalNode,
  allNextNodesFrom,
  isEvaluableCondition,
  SUPPORTED_OPERATORS,
} = require('../workflowGraph');
const { NODE_TYPE } = require('../../config/workflow');

/**
 * A three-step chain: raise → manager signs → finance signs.
 *
 * The shape the engine exists to enforce. Every "skipping a step" test below is
 * about getting from `start` to `finance` without passing through `manager`.
 */
const chain = () => ({
  nodes: [
    { id: 'start', type: NODE_TYPE.TRIGGER },
    { id: 'manager', type: NODE_TYPE.APPROVAL },
    { id: 'finance', type: NODE_TYPE.APPROVAL },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'manager' },
    { id: 'e2', source: 'manager', target: 'finance' },
  ],
});

describe('validateGraph — structural rules (#614)', () => {
  test('a well-formed chain has no errors', () => {
    expect(validateGraph(chain())).toEqual([]);
  });

  test('an empty graph is rejected', () => {
    expect(validateGraph({ nodes: [], edges: [] })).toContain(
      'A workflow needs at least one node',
    );
  });

  test('a missing nodes array is rejected rather than throwing', () => {
    expect(validateGraph({})).toHaveLength(1);
    expect(validateGraph(null)).toHaveLength(1);
    expect(validateGraph(undefined)).toHaveLength(1);
  });

  test('a node without an id is rejected', () => {
    const graph = chain();
    graph.nodes.push({ type: NODE_TYPE.APPROVAL });

    expect(validateGraph(graph).join(' ')).toMatch(/non-empty id/);
  });

  test('a blank node id is rejected', () => {
    const graph = chain();
    graph.nodes.push({ id: '   ', type: NODE_TYPE.APPROVAL });

    expect(validateGraph(graph).join(' ')).toMatch(/non-empty id/);
  });

  test('duplicate node ids are rejected', () => {
    const graph = chain();
    graph.nodes.push({ id: 'manager', type: NODE_TYPE.APPROVAL });

    // Two nodes with one id makes `currentNodeId` ambiguous: the instance is
    // standing on one of them and nothing can say which.
    expect(validateGraph(graph).join(' ')).toMatch(
      /Duplicate node ids: manager/,
    );
  });

  test('a graph with no trigger is rejected — there is nowhere to start', () => {
    const graph = chain();
    graph.nodes[0].type = NODE_TYPE.APPROVAL;

    expect(validateGraph(graph).join(' ')).toMatch(
      /exactly one trigger node, and has none/,
    );
  });

  test('a graph with two triggers is rejected, and says how many it found', () => {
    const graph = chain();
    graph.nodes[1].type = NODE_TYPE.TRIGGER;

    expect(validateGraph(graph).join(' ')).toMatch(
      /exactly one trigger node, and has 2/,
    );
  });

  test('an edge from a node that does not exist is rejected', () => {
    const graph = chain();
    graph.edges.push({ id: 'e3', source: 'ghost', target: 'finance' });

    expect(validateGraph(graph).join(' ')).toMatch(
      /starts at unknown node "ghost"/,
    );
  });

  test('an edge to a node that does not exist is rejected', () => {
    const graph = chain();
    graph.edges.push({ id: 'e3', source: 'finance', target: 'ghost' });

    // #590 saved this cleanly. It only failed later, when an instance walked
    // into the dangling edge.
    expect(validateGraph(graph).join(' ')).toMatch(
      /ends at unknown node "ghost"/,
    );
  });

  test('reports every problem at once, not just the first', () => {
    const graph = {
      nodes: [
        { id: 'a', type: NODE_TYPE.APPROVAL },
        { id: 'a', type: NODE_TYPE.APPROVAL },
      ],
      edges: [{ id: 'e', source: 'ghost', target: 'nowhere' }],
    };

    // A client fixing a definition in the builder should see everything wrong
    // with it in one response, not discover the next problem on each save.
    expect(validateGraph(graph).length).toBeGreaterThanOrEqual(4);
  });

  test('a single trigger node with no edges is a valid one-step workflow', () => {
    expect(
      validateGraph({
        nodes: [{ id: 'only', type: NODE_TYPE.TRIGGER }],
        edges: [],
      }),
    ).toEqual([]);
  });
});

describe('findTriggerNode (#614)', () => {
  test('returns the node a new instance starts on', () => {
    expect(findTriggerNode(chain()).id).toBe('start');
  });

  test('returns null when there is no trigger', () => {
    expect(
      findTriggerNode({ nodes: [{ id: 'a', type: NODE_TYPE.APPROVAL }] }),
    ).toBeNull();
    expect(findTriggerNode({})).toBeNull();
    expect(findTriggerNode(null)).toBeNull();
  });
});

describe('hasNode (#614)', () => {
  test('finds a node that is in the graph', () => {
    expect(hasNode(chain(), 'manager')).toBe(true);
  });

  test('rejects an id that is not', () => {
    // #590 wrote `nextNodeId` straight onto the instance without this check,
    // which stranded it on a node no participant could ever be standing at.
    expect(hasNode(chain(), 'ghost')).toBe(false);
    expect(hasNode(chain(), undefined)).toBe(false);
  });
});

describe('hasEdge — the check that makes a chain a chain (#614)', () => {
  test('accepts a step the graph defines', () => {
    expect(hasEdge(chain(), 'start', 'manager')).toBe(true);
    expect(hasEdge(chain(), 'manager', 'finance')).toBe(true);
  });

  test('refuses a jump that skips the manager', () => {
    // The whole point of a multi-step approval is that step two is unreachable
    // without step one. #590 checked nothing, so this was allowed.
    expect(hasEdge(chain(), 'start', 'finance')).toBe(false);
  });

  test('is directional — an approval cannot be walked backwards', () => {
    expect(hasEdge(chain(), 'manager', 'start')).toBe(false);
  });

  test('handles a graph with no edges', () => {
    expect(hasEdge({ nodes: [] }, 'a', 'b')).toBe(false);
  });
});

describe('nextNodesFrom (#614)', () => {
  test('lists the steps available from a node', () => {
    expect(nextNodesFrom(chain(), 'start')).toEqual(['manager']);
  });

  test('is empty at the end of the chain', () => {
    expect(nextNodesFrom(chain(), 'finance')).toEqual([]);
  });

  test('lists every branch when a node forks', () => {
    const graph = chain();
    graph.nodes.push({ id: 'legal', type: NODE_TYPE.APPROVAL });
    graph.edges.push({ id: 'e3', source: 'start', target: 'legal' });

    expect(nextNodesFrom(graph, 'start').sort()).toEqual(['legal', 'manager']);
  });
});

describe('isTerminalNode (#614)', () => {
  test('the last node in the chain is terminal', () => {
    expect(isTerminalNode(chain(), 'finance')).toBe(true);
  });

  test('a node with a step out of it is not', () => {
    // `approve_final` here would complete the run two steps early, which is the
    // same bug as skipping them.
    expect(isTerminalNode(chain(), 'start')).toBe(false);
    expect(isTerminalNode(chain(), 'manager')).toBe(false);
  });
});

/**
 * Conditional edges (#894).
 *
 * The regression that motivated all of this: the module could not be parsed at
 * all, because the conditional-edge merge left `const { NODE_TYPE } = ...`
 * declared twice. That one is covered by the fact that this file can `require`
 * the module — a `SyntaxError` fails every test above before any assertion runs.
 *
 * What is left to test is the behaviour the duplicate was hiding. An edge
 * carrying a condition is open or closed depending on the record under
 * approval, so every question about the graph needs that record, and the two
 * questions that do *not* take one — `isTerminalNode` and `allNextNodesFrom` —
 * have to be the ones where the answer must not depend on it.
 */

/** The same chain, with the step to finance gated on the amount. */
const gatedChain = () => ({
  nodes: [
    { id: 'start', type: NODE_TYPE.TRIGGER },
    { id: 'manager', type: NODE_TYPE.APPROVAL },
    { id: 'finance', type: NODE_TYPE.APPROVAL },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'manager' },
    {
      id: 'e2',
      source: 'manager',
      target: 'finance',
      condition: { field: 'netSalary', operator: '>=', value: 50000 },
    },
  ],
});

describe('conditional edges — hasEdge (#894)', () => {
  test('an edge whose condition holds is open', () => {
    expect(
      hasEdge(gatedChain(), 'manager', 'finance', { netSalary: 90000 }),
    ).toBe(true);
  });

  test('an edge whose condition does not hold is closed', () => {
    expect(
      hasEdge(gatedChain(), 'manager', 'finance', { netSalary: 1000 }),
    ).toBe(false);
  });

  test('a dotted field resolves through the entity key', () => {
    const graph = gatedChain();
    graph.edges[1].condition = {
      field: 'payroll.netSalary',
      operator: '>=',
      value: 50000,
    };

    expect(
      hasEdge(graph, 'manager', 'finance', { payroll: { netSalary: 90000 } }),
    ).toBe(true);
  });

  test('an unconditional edge stays open whatever the context says', () => {
    // Every workflow defined before conditions existed is this case, so it is
    // the one that decides whether the feature was backwards compatible.
    expect(hasEdge(gatedChain(), 'start', 'manager', {})).toBe(true);
    expect(hasEdge(gatedChain(), 'start', 'manager')).toBe(true);
  });

  test('a condition asked without a context is closed, not open', () => {
    // This is the shape of the bug: callers that forgot the context got `false`
    // rather than an error, so a live approval chain silently stopped working.
    // The behaviour is right — an unevaluable condition must not open an edge —
    // which is exactly why it was invisible, and why the fix had to be at the
    // call sites.
    expect(hasEdge(gatedChain(), 'manager', 'finance')).toBe(false);
  });

  test('the `rule` spelling is accepted alongside `condition`', () => {
    const graph = gatedChain();
    graph.edges[1] = {
      id: 'e2',
      source: 'manager',
      target: 'finance',
      rule: { field: 'netSalary', operator: '>=', value: 50000 },
    };

    expect(hasEdge(graph, 'manager', 'finance', { netSalary: 90000 })).toBe(
      true,
    );
    expect(hasEdge(graph, 'manager', 'finance', { netSalary: 10 })).toBe(false);
  });
});

describe('conditional edges — nextNodesFrom (#894)', () => {
  test('lists only the branches open for this record', () => {
    expect(
      nextNodesFrom(gatedChain(), 'manager', { netSalary: 90000 }),
    ).toEqual(['finance']);
    expect(nextNodesFrom(gatedChain(), 'manager', { netSalary: 100 })).toEqual(
      [],
    );
  });

  test('a fork routes on the condition rather than offering both', () => {
    const graph = gatedChain();
    graph.nodes.push({ id: 'autopay', type: NODE_TYPE.ACTION });
    graph.edges.push({
      id: 'e3',
      source: 'manager',
      target: 'autopay',
      condition: { field: 'netSalary', operator: '<', value: 50000 },
    });

    expect(nextNodesFrom(graph, 'manager', { netSalary: 90000 })).toEqual([
      'finance',
    ]);
    expect(nextNodesFrom(graph, 'manager', { netSalary: 100 })).toEqual([
      'autopay',
    ]);
  });
});

describe('conditional edges — isTerminalNode (#894)', () => {
  test('a node whose only exit is a closed condition is NOT terminal', () => {
    // The expensive half of #894. `isTerminalNode` used to ask `nextNodesFrom`,
    // which — with no context to evaluate against — came back empty, so this
    // returned true and `approve_final` completed the run at `manager`. Finance
    // never saw it, and the instance carried a `completed` status that says it
    // went through a step it never went through.
    expect(isTerminalNode(gatedChain(), 'manager')).toBe(false);
  });

  test('is the same answer whether or not the condition holds', () => {
    // Whether a run is over is a property of the workflow. Which way it goes is
    // a property of the record. Conflating the two is the bug.
    expect(isTerminalNode(gatedChain(), 'manager')).toBe(false);
    expect(isTerminalNode(gatedChain(), 'finance')).toBe(true);
  });
});

describe('allNextNodesFrom (#894)', () => {
  test('lists edges out of a node regardless of their conditions', () => {
    expect(allNextNodesFrom(gatedChain(), 'manager')).toEqual(['finance']);
  });

  test('is empty at the end of the chain', () => {
    expect(allNextNodesFrom(gatedChain(), 'finance')).toEqual([]);
  });

  test('tolerates a graph with no edges', () => {
    expect(allNextNodesFrom({ nodes: [] }, 'a')).toEqual([]);
  });
});

describe('validateGraph — edge conditions (#894)', () => {
  test('a well-formed condition passes', () => {
    expect(validateGraph(gatedChain())).toEqual([]);
  });

  test('a raw AST condition passes', () => {
    const graph = gatedChain();
    graph.edges[1].condition = {
      type: 'BinaryExpression',
      operator: '>=',
      left: { type: 'Identifier', name: 'netSalary' },
      right: { type: 'Literal', value: 50000 },
    };

    expect(validateGraph(graph)).toEqual([]);
  });

  test('an unsupported operator is rejected at save time', () => {
    // `ASTEvaluator.evaluateRule` returns true for anything it cannot parse, so
    // without this check a typo'd operator does not fail — it turns the edge
    // unconditional and quietly deletes the branch the author wrote. Save time
    // is the only moment this is visible to anyone.
    const graph = gatedChain();
    graph.edges[1].condition = {
      field: 'netSalary',
      operator: '=>',
      value: 50000,
    };

    expect(validateGraph(graph).join(' ')).toMatch(/cannot be evaluated/);
  });

  test('a condition with no field is rejected', () => {
    const graph = gatedChain();
    graph.edges[1].condition = { operator: '>=', value: 50000 };

    expect(validateGraph(graph).join(' ')).toMatch(/cannot be evaluated/);
  });

  test('a non-object condition is rejected', () => {
    const graph = gatedChain();
    graph.edges[1].condition = 'netSalary >= 50000';

    expect(validateGraph(graph).join(' ')).toMatch(/cannot be evaluated/);
  });

  test('the error names the edge, so the builder can highlight it', () => {
    const graph = gatedChain();
    graph.edges[1].condition = { field: 'netSalary', operator: '~=', value: 1 };

    expect(validateGraph(graph).join(' ')).toMatch(/Edge "e2"/);
  });

  test('structural errors and condition errors are reported together', () => {
    // The reason validateGraph returns a list rather than throwing on the first
    // problem: one save, one round trip, every problem.
    const graph = gatedChain();
    graph.edges[1].condition = { field: 'netSalary', operator: '~=', value: 1 };
    graph.edges.push({ id: 'e9', source: 'manager', target: 'nowhere' });

    const errors = validateGraph(graph).join(' ');
    expect(errors).toMatch(/cannot be evaluated/);
    expect(errors).toMatch(/unknown node "nowhere"/);
  });
});

describe('isEvaluableCondition (#894)', () => {
  test('an absent condition is fine — a plain edge is always open', () => {
    expect(isEvaluableCondition(undefined)).toBe(true);
    expect(isEvaluableCondition(null)).toBe(true);
  });

  test('every supported operator is accepted', () => {
    for (const operator of SUPPORTED_OPERATORS) {
      expect(
        isEvaluableCondition({ field: 'amount', operator, value: 1 }),
      ).toBe(true);
    }
  });

  test('an array is not a condition', () => {
    expect(
      isEvaluableCondition([{ field: 'a', operator: '>=', value: 1 }]),
    ).toBe(false);
  });

  test('a blank field is not a condition', () => {
    expect(
      isEvaluableCondition({ field: '  ', operator: '>=', value: 1 }),
    ).toBe(false);
  });

  test('a blank AST type is not a condition', () => {
    expect(isEvaluableCondition({ type: '   ' })).toBe(false);
  });
});
