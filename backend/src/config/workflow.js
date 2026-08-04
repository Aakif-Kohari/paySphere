/**
 * Canonical vocabulary for the workflow engine (#590, repaired in #614).
 *
 * The same pattern as config/payrollStatus.js and config/accountTypes.js: the
 * strings the schema validates against, the controller compares against and the
 * tests assert on all come from one file, so they cannot drift apart. #590 had
 * the vocabulary inline in `transitionInstance`:
 *
 *     if (action === 'approve_final') instance.status = 'completed';
 *     if (action === 'reject')        instance.status = 'rejected';
 *
 * which meant any other string was accepted, recorded in `history`, and moved
 * the instance to whatever node the caller asked for without changing its
 * status — an approval step that silently did nothing.
 */

/** What a participant can do at a node. */
const WORKFLOW_ACTION = {
  /** Move on to the next node. The instance stays `pending`. */
  APPROVE: 'approve',
  /** Approve the final node. The instance completes. */
  APPROVE_FINAL: 'approve_final',
  /** Throw the request out. Terminal. */
  REJECT: 'reject',
};

const ALL_WORKFLOW_ACTIONS = Object.values(WORKFLOW_ACTION);

/** Where an instance has got to. */
const INSTANCE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
};

const ALL_INSTANCE_STATUSES = Object.values(INSTANCE_STATUS);

/**
 * Statuses from which no further transition is allowed.
 *
 * #590 guarded nothing, so posting `reject` to an instance that had already
 * completed flipped it to rejected and appended both entries to `history`. An
 * approval trail that can be rewritten after the fact is not an approval trail.
 */
const TERMINAL_STATUSES = [INSTANCE_STATUS.COMPLETED, INSTANCE_STATUS.REJECTED];

/** The node types a workflow graph is built from. */
const NODE_TYPE = {
  TRIGGER: 'trigger',
  APPROVAL: 'approval',
  CONDITION: 'condition',
  ACTION: 'action',
};

const ALL_NODE_TYPES = Object.values(NODE_TYPE);

/** The entities an instance can be raised against. */
const TARGET_ENTITY_TYPE = {
  PAYROLL: 'Payroll',
  LOAN: 'Loan',
  EMPLOYEE: 'Employee',
};

const ALL_TARGET_ENTITY_TYPES = Object.values(TARGET_ENTITY_TYPE);

/**
 * Is this a state the instance can still move out of?
 *
 * @param {string} status
 * @returns {boolean}
 */
function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * The status an action leaves the instance in.
 *
 * @param {string} action a WORKFLOW_ACTION value
 * @returns {string|null} an INSTANCE_STATUS value, or null for an unknown action
 */
function statusAfter(action) {
  switch (action) {
    case WORKFLOW_ACTION.APPROVE:
      return INSTANCE_STATUS.PENDING;
    case WORKFLOW_ACTION.APPROVE_FINAL:
      return INSTANCE_STATUS.COMPLETED;
    case WORKFLOW_ACTION.REJECT:
      return INSTANCE_STATUS.REJECTED;
    default:
      return null;
  }
}

module.exports = {
  WORKFLOW_ACTION,
  ALL_WORKFLOW_ACTIONS,
  INSTANCE_STATUS,
  ALL_INSTANCE_STATUSES,
  TERMINAL_STATUSES,
  NODE_TYPE,
  ALL_NODE_TYPES,
  TARGET_ENTITY_TYPE,
  ALL_TARGET_ENTITY_TYPES,
  isTerminal,
  statusAfter,
};
