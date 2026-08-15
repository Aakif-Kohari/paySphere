/**
 * Salary component vocabulary (#461).
 *
 * An employee's pay is stored as a single mutable `monthlySalary`. Editing it
 * overwrites the old value in place — no record that a raise happened, no
 * record of what it was before, no effective date, and no breakdown to put on
 * a payslip. "What was Priya earning in March?" is unanswerable, which is
 * precisely the question a payroll audit asks.
 *
 * This module defines the components a package can be built from and the
 * default template used to migrate an existing single-figure salary into one,
 * so no admin has to re-enter anything.
 */

const COMPONENT_TYPE = {
  EARNING: 'earning',
  DEDUCTION: 'deduction',
};

/**
 * How a component's amount is arrived at.
 *
 * `percent_of_basic` and `percent_of_gross` are resolved in a fixed order (see
 * `salaryStructure.js`) so the same structure always produces the same figures.
 */
const CALCULATION = {
  FIXED: 'fixed',
  PERCENT_OF_BASIC: 'percent_of_basic',
  PERCENT_OF_GROSS: 'percent_of_gross',
};

/** Why a revision was created. Drives the audit trail and the UI timeline. */
const REVISION_REASON = {
  INITIAL: 'initial',
  REVISION: 'revision',
  PROMOTION: 'promotion',
  /**
   * A correction to a previous revision. Revisions are append-only, so fixing
   * a typo means adding a new revision rather than editing an old one — that
   * is what makes the history tamper-evident, the same property AuditLog has.
   */
  CORRECTION: 'correction',
};

const ALL_REVISION_REASONS = Object.values(REVISION_REASON);

/** Well-known component codes. Custom codes are allowed alongside these. */
const COMPONENT_CODE = {
  BASIC: 'BASIC',
  HRA: 'HRA',
  CONVEYANCE: 'CONVEYANCE',
  MEDICAL: 'MEDICAL',
  SPECIAL_ALLOWANCE: 'SPECIAL_ALLOWANCE',
};

const COMPONENT_LABELS = {
  [COMPONENT_CODE.BASIC]: 'Basic',
  [COMPONENT_CODE.HRA]: 'House Rent Allowance',
  [COMPONENT_CODE.CONVEYANCE]: 'Conveyance',
  [COMPONENT_CODE.MEDICAL]: 'Medical Allowance',
  [COMPONENT_CODE.SPECIAL_ALLOWANCE]: 'Special Allowance',
};

/**
 * The template used to split an existing `monthlySalary` into components.
 *
 * Deliberately expressed as percentages of gross with a residual, so it works
 * for any salary figure and always reconstitutes to exactly the original
 * amount — a migration that changed anyone's pay would be worse than no
 * migration at all.
 *
 * `SPECIAL_ALLOWANCE` is the residual: whatever is left after the named
 * components, which is how the balancing figure works in practice.
 */
const DEFAULT_STRUCTURE_TEMPLATE = [
  {
    code: COMPONENT_CODE.BASIC,
    label: COMPONENT_LABELS[COMPONENT_CODE.BASIC],
    type: COMPONENT_TYPE.EARNING,
    calculation: CALCULATION.PERCENT_OF_GROSS,
    value: 50,
    taxable: true,
  },
  {
    code: COMPONENT_CODE.HRA,
    label: COMPONENT_LABELS[COMPONENT_CODE.HRA],
    type: COMPONENT_TYPE.EARNING,
    calculation: CALCULATION.PERCENT_OF_BASIC,
    value: 40,
    taxable: true,
  },
  {
    code: COMPONENT_CODE.SPECIAL_ALLOWANCE,
    label: COMPONENT_LABELS[COMPONENT_CODE.SPECIAL_ALLOWANCE],
    // The balancing figure — resolved as the residual, never as a percentage.
    type: COMPONENT_TYPE.EARNING,
    calculation: CALCULATION.FIXED,
    value: 0,
    taxable: true,
    isResidual: true,
  },
];

const MAX_COMPONENTS = 25;
const MAX_COMPONENT_CODE_LENGTH = 40;
const MAX_COMPONENT_LABEL_LENGTH = 100;

/**
 * Resolution order for percentage components.
 *
 * `percent_of_basic` must resolve after BASIC is known, and `percent_of_gross`
 * against the declared gross rather than a running subtotal — otherwise the
 * result depends on the order the components happen to be stored in, which is
 * not a property a salary structure may have.
 */
const CALCULATION_ORDER = [
  CALCULATION.FIXED,
  CALCULATION.PERCENT_OF_GROSS,
  CALCULATION.PERCENT_OF_BASIC,
];

module.exports = {
  COMPONENT_TYPE,
  CALCULATION,
  CALCULATION_ORDER,
  REVISION_REASON,
  ALL_REVISION_REASONS,
  COMPONENT_CODE,
  COMPONENT_LABELS,
  DEFAULT_STRUCTURE_TEMPLATE,
  MAX_COMPONENTS,
  MAX_COMPONENT_CODE_LENGTH,
  MAX_COMPONENT_LABEL_LENGTH,
};
