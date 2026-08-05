const {
  validateGraph,
  findTriggerNode,
  hasNode,
  hasEdge,
  nextNodesFrom,
  isTerminalNode,
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
    expect(validateGraph(graph).join(' ')).toMatch(/Duplicate node ids: manager/);
  });

  test('a graph with no trigger is rejected — there is nowhere to start', () => {
    const graph = chain();
    graph.nodes[0].type = NODE_TYPE.APPROVAL;

    expect(validateGraph(graph).join(' ')).toMatch(/exactly one trigger node, and has none/);
  });

  test('a graph with two triggers is rejected, and says how many it found', () => {
    const graph = chain();
    graph.nodes[1].type = NODE_TYPE.TRIGGER;

    expect(validateGraph(graph).join(' ')).toMatch(/exactly one trigger node, and has 2/);
  });

  test('an edge from a node that does not exist is rejected', () => {
    const graph = chain();
    graph.edges.push({ id: 'e3', source: 'ghost', target: 'finance' });

    expect(validateGraph(graph).join(' ')).toMatch(/starts at unknown node "ghost"/);
  });

  test('an edge to a node that does not exist is rejected', () => {
    const graph = chain();
    graph.edges.push({ id: 'e3', source: 'finance', target: 'ghost' });

    // #590 saved this cleanly. It only failed later, when an instance walked
    // into the dangling edge.
    expect(validateGraph(graph).join(' ')).toMatch(/ends at unknown node "ghost"/);
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
      validateGraph({ nodes: [{ id: 'only', type: NODE_TYPE.TRIGGER }], edges: [] }),
    ).toEqual([]);
  });
});

describe('findTriggerNode (#614)', () => {
  test('returns the node a new instance starts on', () => {
    expect(findTriggerNode(chain()).id).toBe('start');
  });

  test('returns null when there is no trigger', () => {
    expect(findTriggerNode({ nodes: [{ id: 'a', type: NODE_TYPE.APPROVAL }] })).toBeNull();
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
