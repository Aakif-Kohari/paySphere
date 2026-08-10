const mongoose = require('mongoose');
const Workflow = require('../../models/workflow.model');
const WorkflowInstance = require('../../models/workflowInstance.model');
const Payroll = require('../../models/payroll.model');
const { transitionInstance } = require('../workflow.controller');
const {
  NODE_TYPE,
  WORKFLOW_ACTION,
  INSTANCE_STATUS,
} = require('../../config/workflow');

/**
 * `transitionInstance` against a workflow with conditional edges (#894).
 *
 * The graph rules themselves are unit-tested in utils/__tests__/workflowGraph.
 * What is tested here is the wiring, because the wiring is what was broken: the
 * rules grew an `entityContext` parameter and the controller kept calling them
 * with three arguments, so every condition was evaluated against `{}`.
 *
 * Two failures came out of that, and both are asserted below:
 *
 *   - `approve` along a conditional edge was refused for a record the condition
 *     plainly holds for, stranding the run with no way forward.
 *   - `approve_final` was *accepted* at a mid-chain node, because a node whose
 *     only exit was conditional looked terminal. The run completed without the
 *     remaining approvers, and its history recorded a signature nobody gave.
 */

jest.mock('../../models/workflow.model');
jest.mock('../../models/workflowInstance.model');
jest.mock('../../models/payroll.model');
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
const WORKFLOW_ID = oid();
const INSTANCE_ID = oid();
const PAYROLL_ID = oid();

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

/**
 * raise → manager signs → finance signs, where the step to finance only exists
 * for a run over 50,000. The everyday shape of an approval matrix: small runs
 * stop at the manager, large ones need the CFO.
 */
const gatedGraph = () => ({
  _id: WORKFLOW_ID,
  name: 'Payroll approval',
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

const instanceAt = (nodeId, overrides = {}) => ({
  _id: INSTANCE_ID,
  workflowId: WORKFLOW_ID,
  currentNodeId: nodeId,
  targetEntityId: PAYROLL_ID,
  targetEntityType: 'Payroll',
  status: INSTANCE_STATUS.PENDING,
  history: [],
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

/** `Payroll.findOne(...).lean()` resolving to one record, or to nothing. */
const payrollIs = (doc) => {
  Payroll.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });
};

const makeReq = (body) => ({
  params: { instanceId: INSTANCE_ID },
  body,
  userId: USER,
  tenantId: TENANT,
});

beforeEach(() => {
  jest.clearAllMocks();
  Workflow.findOne.mockResolvedValue(gatedGraph());
});

describe('approving along a conditional edge (#894)', () => {
  test('is allowed when the condition holds for the record', () => {
    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs({ _id: PAYROLL_ID, netSalary: 90000 });

    const res = makeRes();

    return transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'finance' }),
      res,
      jest.fn(),
    ).then(() => {
      expect(res.status).toHaveBeenCalledWith(200);
      expect(instance.currentNodeId).toBe('finance');
      expect(instance.save).toHaveBeenCalled();
    });
  });

  test('is not refused for a record the condition plainly matches', async () => {
    // The regression in one assertion: with no context threaded through,
    // `netSalary >= 50000` became `Number(undefined) >= 50000` and the only
    // step out of `manager` was invisible.
    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs({ _id: PAYROLL_ID, netSalary: 1_000_000 });

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'finance' }),
      res,
      jest.fn(),
    );

    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('is refused when the condition does not hold, and says why', async () => {
    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs({ _id: PAYROLL_ID, netSalary: 1200 });

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'finance' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);

    // "no step from x to y" would be a lie here — the approver can see the step
    // in the builder. The message has to distinguish a missing edge from a
    // closed one, or the report that comes back is "the workflow is broken".
    const [[payload]] = res.json.mock.calls;
    expect(payload.message).toMatch(/condition does not hold/);
    expect(instance.save).not.toHaveBeenCalled();
  });

  test('a genuinely missing edge still says so', async () => {
    const instance = instanceAt('start');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs({ _id: PAYROLL_ID, netSalary: 90000 });

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'finance' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    const [[payload]] = res.json.mock.calls;
    expect(payload.message).toMatch(/no step from "start" to "finance"/);
  });

  test('the open branches are reported back, so the client can offer them', async () => {
    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs({ _id: PAYROLL_ID, netSalary: 90000 });

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'nowhere' }),
      res,
      jest.fn(),
    );

    const [[payload]] = res.json.mock.calls;
    expect(payload.nextNodes).toEqual(['finance']);
  });
});

describe('approve_final cannot complete a chain early (#894)', () => {
  test('is refused at a node whose only exit is a closed condition', async () => {
    // The expensive half. `manager` had no *open* next node for this record, so
    // `isTerminalNode` said true, so this was accepted: the run went to
    // `completed` and finance never saw it. Whether a run is over is a property
    // of the workflow, not of the record.
    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs({ _id: PAYROLL_ID, netSalary: 100 });

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE_FINAL }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/not the final step/),
      }),
    );
    expect(instance.status).toBe(INSTANCE_STATUS.PENDING);
    expect(instance.save).not.toHaveBeenCalled();
  });

  test('is refused at that node for a record the condition does match, too', async () => {
    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs({ _id: PAYROLL_ID, netSalary: 90000 });

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE_FINAL }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('is allowed at the node that really is last', async () => {
    const instance = instanceAt('finance');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs({ _id: PAYROLL_ID, netSalary: 90000 });

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE_FINAL }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(instance.status).toBe(INSTANCE_STATUS.COMPLETED);
  });
});

describe('loading the record a run is about (#894)', () => {
  test('the lookup is scoped to the caller tenant', async () => {
    WorkflowInstance.findOne.mockResolvedValue(instanceAt('manager'));
    payrollIs({ _id: PAYROLL_ID, netSalary: 90000 });

    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'finance' }),
      makeRes(),
      jest.fn(),
    );

    expect(Payroll.findOne).toHaveBeenCalledWith({
      _id: PAYROLL_ID,
      tenantId: TENANT,
    });
  });

  test('a deleted target closes conditional edges rather than throwing', async () => {
    // An approval is not the moment to surface a 500. A record that is gone
    // cannot satisfy a condition, so the edge closes and the approver gets a
    // 400 they can act on.
    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs(null);

    const next = jest.fn();
    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'finance' }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('a database error on the target does not fail the request', async () => {
    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    Payroll.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('connection reset')),
    });

    const next = jest.fn();
    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'finance' }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejecting needs no target record at all', async () => {
    // Rejection ends the run wherever it is standing, so it asks the graph
    // nothing and must not be blocked by an entity that cannot be loaded.
    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs(null);

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.REJECT }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(instance.status).toBe(INSTANCE_STATUS.REJECTED);
  });

  test('an instance with no target entity is handled without a lookup', async () => {
    const instance = instanceAt('start', {
      targetEntityId: undefined,
      targetEntityType: undefined,
    });
    WorkflowInstance.findOne.mockResolvedValue(instance);

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'manager' }),
      res,
      jest.fn(),
    );

    expect(Payroll.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('the record is exposed both flat and under its type name', async () => {
    // `netSalary` and `payroll.netSalary` both appear in real definitions, so
    // both have to resolve. Asserted through behaviour: a dotted rule on a
    // graph whose flat equivalent is absent still routes.
    Workflow.findOne.mockResolvedValue({
      ...gatedGraph(),
      edges: [
        { id: 'e1', source: 'start', target: 'manager' },
        {
          id: 'e2',
          source: 'manager',
          target: 'finance',
          condition: {
            field: 'payroll.netSalary',
            operator: '>=',
            value: 50000,
          },
        },
      ],
    });

    const instance = instanceAt('manager');
    WorkflowInstance.findOne.mockResolvedValue(instance);
    payrollIs({ _id: PAYROLL_ID, netSalary: 90000 });

    const res = makeRes();
    await transitionInstance(
      makeReq({ action: WORKFLOW_ACTION.APPROVE, nextNodeId: 'finance' }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
