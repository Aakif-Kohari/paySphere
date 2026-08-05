const mongoose = require('mongoose');
const Workflow = require('../../models/workflow.model');
const WorkflowInstance = require('../../models/workflowInstance.model');
const {
  createWorkflow,
  getWorkflows,
  startInstance,
  getInstances,
  transitionInstance,
} = require('../workflow.controller');
const { NODE_TYPE, WORKFLOW_ACTION, INSTANCE_STATUS } = require('../../config/workflow');

jest.mock('../../models/workflow.model');
jest.mock('../../models/workflowInstance.model');
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
  emitAuditLog: jest.fn(),
  on: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

const oid = () => new mongoose.Types.ObjectId().toString();

const USER = oid();
const TENANT = oid();
const OTHER_TENANT = oid();
const WORKFLOW_ID = oid();
const INSTANCE_ID = oid();
const TARGET_ID = oid();

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

/** raise → manager signs → finance signs. */
const chainGraph = () => ({
  _id: WORKFLOW_ID,
  name: 'Payroll approval',
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

const instanceDoc = (overrides = {}) => ({
  _id: INSTANCE_ID,
  workflowId: WORKFLOW_ID,
  currentNodeId: 'start',
  status: INSTANCE_STATUS.PENDING,
  history: [],
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

/** `Model.find(...).sort(...).skip(...).limit(...)` */
const listChain = (rows) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(rows),
});

beforeEach(() => {
  jest.clearAllMocks();
  Workflow.find.mockReturnValue(listChain([]));
  Workflow.countDocuments.mockResolvedValue(0);
  WorkflowInstance.find.mockReturnValue(listChain([]));
  WorkflowInstance.countDocuments.mockResolvedValue(0);
});

describe('every handler refuses an unscoped request (#614)', () => {
  const handlers = [
    ['createWorkflow', createWorkflow, { body: {} }],
    ['getWorkflows', getWorkflows, { query: {} }],
    ['startInstance', startInstance, { params: { workflowId: WORKFLOW_ID }, body: {} }],
    ['getInstances', getInstances, { query: {} }],
    [
      'transitionInstance',
      transitionInstance,
      { params: { instanceId: INSTANCE_ID }, body: {} },
    ],
  ];

  test.each(handlers)('%s answers 403 without a tenant', async (_name, handler, req) => {
    const res = makeRes();

    await handler({ userId: USER, ...req }, res, jest.fn());

    // `find({ tenantId: undefined })` is not "match nothing" — the driver drops
    // the key and it becomes "match everything, for every company" (#612).
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test.each(handlers)('%s runs no query without a tenant', async (_name, handler, req) => {
    await handler({ userId: USER, ...req }, makeRes(), jest.fn());

    expect(Workflow.find).not.toHaveBeenCalled();
    expect(Workflow.findOne).not.toHaveBeenCalled();
    expect(WorkflowInstance.find).not.toHaveBeenCalled();
    expect(WorkflowInstance.findOne).not.toHaveBeenCalled();
  });
});

describe('createWorkflow (#614)', () => {
  const req = (body) => ({ userId: USER, tenantId: TENANT, body });

  test('saves a valid chain scoped to the company', async () => {
    Workflow.create.mockResolvedValue(chainGraph());
    const res = makeRes();

    await createWorkflow(req({ name: 'Payroll approval', ...chainGraph() }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    const created = Workflow.create.mock.calls[0][0];
    expect(created.tenantId).toBe(TENANT);
    expect(created.createdBy).toBe(USER);
  });

  test('requires a name', async () => {
    const res = makeRes();

    await createWorkflow(req({ ...chainGraph(), name: '  ' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Workflow.create).not.toHaveBeenCalled();
  });

  test('rejects a graph with a dangling edge, and says which', async () => {
    const graph = chainGraph();
    graph.edges.push({ id: 'e3', source: 'finance', target: 'ghost' });
    const res = makeRes();

    await createWorkflow(req({ name: 'Broken', ...graph }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors.join(' ')).toMatch(/ghost/);
    expect(Workflow.create).not.toHaveBeenCalled();
  });

  test('rejects a graph with no trigger — an instance would have nowhere to start', async () => {
    const graph = chainGraph();
    graph.nodes[0].type = NODE_TYPE.APPROVAL;
    const res = makeRes();

    await createWorkflow(req({ name: 'No start', ...graph }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('hands a write failure to the error middleware rather than echoing it', async () => {
    Workflow.create.mockRejectedValue(new Error('E11000 duplicate key ...'));
    const next = jest.fn();
    const res = makeRes();

    await createWorkflow(req({ name: 'X', ...chainGraph() }), res, next);

    // #590 answered 500 with `err.message` in the body, leaking raw mongoose
    // text and disagreeing with every other handler in the codebase.
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalledWith(500);
  });
});

describe('getWorkflows (#614)', () => {
  test('scopes the list to the company', async () => {
    await getWorkflows({ userId: USER, tenantId: TENANT, query: {} }, makeRes(), jest.fn());

    expect(Workflow.find).toHaveBeenCalledWith({ tenantId: TENANT });
  });

  test('paginates and clamps an absurd page size', async () => {
    const chain = listChain([]);
    Workflow.find.mockReturnValue(chain);

    await getWorkflows(
      { userId: USER, tenantId: TENANT, query: { page: '3', limit: '99999' } },
      makeRes(),
      jest.fn(),
    );

    expect(chain.limit).toHaveBeenCalledWith(20);
  });
});

describe('startInstance — the handler #590 never wrote (#614)', () => {
  const req = (body = {}) => ({
    userId: USER,
    tenantId: TENANT,
    params: { workflowId: WORKFLOW_ID },
    body: { targetEntityId: TARGET_ID, targetEntityType: 'Payroll', ...body },
  });

  beforeEach(() => {
    Workflow.findOne.mockResolvedValue(chainGraph());
    WorkflowInstance.create.mockImplementation(async (doc) => ({ _id: INSTANCE_ID, ...doc }));
  });

  test('starts the request at the trigger node', async () => {
    const res = makeRes();

    await startInstance(req(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    const created = WorkflowInstance.create.mock.calls[0][0];
    expect(created.currentNodeId).toBe('start');
    expect(created.status).toBe(INSTANCE_STATUS.PENDING);
    expect(created.tenantId).toBe(TENANT);
  });

  test("another company's workflow is a 404, not a 403", async () => {
    Workflow.findOne.mockResolvedValue(null);
    const res = makeRes();

    await startInstance(req(), res, jest.fn());

    // Indistinguishable from "does not exist", so a caller cannot probe for
    // another company's workflow ids.
    expect(res.status).toHaveBeenCalledWith(404);
    expect(WorkflowInstance.create).not.toHaveBeenCalled();
  });

  test('scopes the workflow lookup by tenant', async () => {
    await startInstance(req(), makeRes(), jest.fn());

    expect(Workflow.findOne).toHaveBeenCalledWith({
      _id: WORKFLOW_ID,
      tenantId: TENANT,
    });
  });

  test('rejects an unknown target entity type', async () => {
    const res = makeRes();

    await startInstance(req({ targetEntityType: 'Invoice' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects a malformed target id', async () => {
    const res = makeRes();

    await startInstance(req({ targetEntityId: 'not-an-id' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects a malformed workflow id before querying', async () => {
    const res = makeRes();

    await startInstance(
      { userId: USER, tenantId: TENANT, params: { workflowId: 'nope' }, body: {} },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Workflow.findOne).not.toHaveBeenCalled();
  });
});

describe('transitionInstance — graph enforcement (#614)', () => {
  const req = (body, instanceId = INSTANCE_ID) => ({
    userId: USER,
    tenantId: TENANT,
    params: { instanceId },
    body,
  });

  beforeEach(() => {
    Workflow.findOne.mockResolvedValue(chainGraph());
  });

  test('an approve along a real edge moves the instance one step', async () => {
    const instance = instanceDoc();
    WorkflowInstance.findOne.mockResolvedValue(instance);
    const res = makeRes();

    await transitionInstance(
      req({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'manager' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(instance.currentNodeId).toBe('manager');
    expect(instance.status).toBe(INSTANCE_STATUS.PENDING);
    expect(instance.save).toHaveBeenCalled();
  });

  test('refuses a jump that skips a step in the chain', async () => {
    const instance = instanceDoc({ currentNodeId: 'start' });
    WorkflowInstance.findOne.mockResolvedValue(instance);
    const res = makeRes();

    // The whole value of a multi-step approval is that finance cannot sign
    // before the manager has. #590 allowed exactly this.
    await transitionInstance(
      req({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'finance' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(instance.save).not.toHaveBeenCalled();
    expect(instance.currentNodeId).toBe('start');
  });

  test('refuses a node that is not in the workflow at all', async () => {
    const instance = instanceDoc();
    WorkflowInstance.findOne.mockResolvedValue(instance);
    const res = makeRes();

    // #590 wrote this straight onto the document, stranding the instance on a
    // node no participant could ever be standing at.
    await transitionInstance(
      req({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'ghost' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(instance.save).not.toHaveBeenCalled();
  });

  test('a refusal tells the caller where they can actually go', async () => {
    WorkflowInstance.findOne.mockResolvedValue(instanceDoc());
    const res = makeRes();

    await transitionInstance(
      req({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'ghost' }),
      res,
      jest.fn(),
    );

    expect(res.json.mock.calls[0][0].nextNodes).toEqual(['manager']);
  });

  test('approve_final at the last node completes the request', async () => {
    const instance = instanceDoc({ currentNodeId: 'finance' });
    WorkflowInstance.findOne.mockResolvedValue(instance);
    const res = makeRes();

    await transitionInstance(req({ action: WORKFLOW_ACTION.APPROVE_FINAL }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(instance.status).toBe(INSTANCE_STATUS.COMPLETED);
  });

  test('approve_final part-way through is refused — a run cannot complete early', async () => {
    const instance = instanceDoc({ currentNodeId: 'manager' });
    WorkflowInstance.findOne.mockResolvedValue(instance);
    const res = makeRes();

    await transitionInstance(req({ action: WORKFLOW_ACTION.APPROVE_FINAL }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(instance.status).toBe(INSTANCE_STATUS.PENDING);
    expect(instance.save).not.toHaveBeenCalled();
  });

  test('a reject ends the chain wherever it is standing, with no target needed', async () => {
    const instance = instanceDoc({ currentNodeId: 'manager' });
    WorkflowInstance.findOne.mockResolvedValue(instance);
    const res = makeRes();

    await transitionInstance(req({ action: WORKFLOW_ACTION.REJECT }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(instance.status).toBe(INSTANCE_STATUS.REJECTED);
    expect(instance.currentNodeId).toBe('manager');
  });

  test('an unknown action is refused before anything is read', async () => {
    const res = makeRes();

    await transitionInstance(req({ action: 'rubber_stamp' }), res, jest.fn());

    // #590 accepted any string, recorded it in the history, and moved the
    // instance without changing its status.
    expect(res.status).toHaveBeenCalledWith(400);
    expect(WorkflowInstance.findOne).not.toHaveBeenCalled();
  });
});

describe('transitionInstance — terminal states are final (#614)', () => {
  const req = (body) => ({
    userId: USER,
    tenantId: TENANT,
    params: { instanceId: INSTANCE_ID },
    body,
  });

  beforeEach(() => {
    Workflow.findOne.mockResolvedValue(chainGraph());
  });

  test.each([INSTANCE_STATUS.COMPLETED, INSTANCE_STATUS.REJECTED])(
    'a %s request cannot be transitioned again',
    async (status) => {
      const instance = instanceDoc({ status, currentNodeId: 'finance' });
      WorkflowInstance.findOne.mockResolvedValue(instance);
      const res = makeRes();

      await transitionInstance(req({ action: WORKFLOW_ACTION.REJECT }), res, jest.fn());

      // #590 flipped a completed instance to rejected and left both entries in
      // the trail. An approval trail that can be rewritten is not a trail.
      expect(res.status).toHaveBeenCalledWith(409);
      expect(instance.status).toBe(status);
      expect(instance.save).not.toHaveBeenCalled();
      expect(instance.history).toHaveLength(0);
    },
  );
});

describe('transitionInstance — scoping and history (#614)', () => {
  const req = (body) => ({
    userId: USER,
    tenantId: TENANT,
    params: { instanceId: INSTANCE_ID },
    body,
  });

  test('scopes both the instance and the workflow lookup by tenant', async () => {
    WorkflowInstance.findOne.mockResolvedValue(instanceDoc());
    Workflow.findOne.mockResolvedValue(chainGraph());

    await transitionInstance(
      req({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'manager' }),
      makeRes(),
      jest.fn(),
    );

    expect(WorkflowInstance.findOne).toHaveBeenCalledWith({
      _id: INSTANCE_ID,
      tenantId: TENANT,
    });
    expect(Workflow.findOne).toHaveBeenCalledWith({
      _id: WORKFLOW_ID,
      tenantId: TENANT,
    });
  });

  test("another company's instance is a 404", async () => {
    WorkflowInstance.findOne.mockResolvedValue(null);
    const res = makeRes();

    await transitionInstance(
      { ...req({ action: WORKFLOW_ACTION.REJECT }), tenantId: OTHER_TENANT },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('records who acted, at which node, with what', async () => {
    const instance = instanceDoc();
    WorkflowInstance.findOne.mockResolvedValue(instance);
    Workflow.findOne.mockResolvedValue(chainGraph());

    await transitionInstance(
      req({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'manager' }),
      makeRes(),
      jest.fn(),
    );

    expect(instance.history).toHaveLength(1);
    // The node they were standing at when they acted, not the one they moved to.
    expect(instance.history[0]).toMatchObject({
      nodeId: 'start',
      actionBy: USER,
      action: WORKFLOW_ACTION.APPROVE,
    });
  });

  test('an instance whose workflow has been deleted is a 409, not a crash', async () => {
    WorkflowInstance.findOne.mockResolvedValue(instanceDoc());
    Workflow.findOne.mockResolvedValue(null);
    const res = makeRes();

    await transitionInstance(
      req({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'manager' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('getInstances (#614)', () => {
  test('scopes the list to the company', async () => {
    await getInstances({ userId: USER, tenantId: TENANT, query: {} }, makeRes(), jest.fn());

    expect(WorkflowInstance.find).toHaveBeenCalledWith({ tenantId: TENANT });
  });

  test('filters by status', async () => {
    await getInstances(
      { userId: USER, tenantId: TENANT, query: { status: INSTANCE_STATUS.PENDING } },
      makeRes(),
      jest.fn(),
    );

    expect(WorkflowInstance.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      status: INSTANCE_STATUS.PENDING,
    });
  });

  test('rejects an unknown status filter rather than returning everything', async () => {
    const res = makeRes();

    await getInstances(
      { userId: USER, tenantId: TENANT, query: { status: 'maybe' } },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(WorkflowInstance.find).not.toHaveBeenCalled();
  });
});
