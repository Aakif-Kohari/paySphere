## Summary

PaySphere's salary computation is entirely hardcoded in payroll.worker.js. Every tenant runs the same formula: gross = baseSalary + overtimePay + bonus - leaveDeduction. Components like HRA, conveyance, PF employee/employer share, professional tax, and variable pay do not exist as configurable line items. Adding a new salary component for a single tenant requires a code change and redeployment.

## Problem Statement

1. **Hardcoded formula**: The gross calculation in payroll.worker.js (lines 80–110) is not driven by data. Multi-tenancy requires per-tenant component rules — a startup's salary structure differs fundamentally from an enterprise running PF + ESIC + LTA + variable pay.
2. **No component versioning**: When HR modifies the HRA percentage from 40% to 50%, historical payslips retroactively change because the component definition has no effective-date changelog. Audit trails require immutability of the formula used at run time.
3. **No formula DSL validation**: The stEvaluator.service.js exists but is never connected to salaryStructure.model.js. A misconfigured formula crashes the payroll worker with an unhelpful TypeError at 2 AM.
4. **No component dependency graph**: PF employer share depends on PF employee share which depends on basic. Circular dependency or wrong evaluation order silently produces incorrect results.

## Proposed Implementation

### Backend

- **salaryStructure.model.js extension**: Add components[] array — each entry: { code, name, type: earnings|deductions|info, formula: string, order: int, effectiveFrom, effectiveTo }. Add ersion counter incremented on every update. Store a history[] of past component snapshots with their effective ranges.
- **ormulaEngine.service.js** (new):
  - parseAndValidate(formulaString, knownVars) — runs stEvaluator dry and returns { valid, errors, dependsOn[] }.
  - uildEvalOrder(components) — topological sort of the dependency graph; throws CircularDependencyError if a cycle is detected.
  - evaluateAll(components, context) — evaluates components in topo order, accumulating a lineItems map. Each result is injected into context so later components can reference earlier ones.
- **salaryStructure.controller.js** extension: PUT /api/salary-structures/:id/components — calls parseAndValidate on every formula before saving; returns 422 with per-component errors on failure.
- **payroll.worker.js** refactor: Replace the hardcoded block with ormulaEngine.evaluateAll(structure.components, context). The context includes { baseSalary, leaveDays, overtimeHours, attendance, ytdGross }.
- **salaryComponentAudit.model.js** (new): Immutable document written at payroll run time capturing the exact component snapshot (structureId, ersion, components[] deep copy). Referenced from payroll.model.js via componentSnapshotId.

### Frontend

- **SalaryStructureBuilder.jsx** (new): Drag-and-drop component list with formula input per component, live preview panel (calls POST /api/salary-structures/preview with sample values), and dependency graph visualisation (D3 force graph or dagre layout).
- **ComponentVersionHistory.jsx** (new): Timeline showing each version's effective date, changed fields, and the user who made the change.

## Files Affected

- ackend/src/models/salaryStructure.model.js — extend schema
- ackend/src/models/salaryComponentAudit.model.js — new
- ackend/src/services/formulaEngine.service.js — new
- ackend/src/controllers/salaryStructure.controller.js — extend
- ackend/src/workers/payroll.worker.js — refactor formula block
- ackend/src/routes/salaryStructure.routes.js — new preview endpoint
- rontend/src/pages/SalaryStructures.jsx — wire builder
- rontend/src/components/SalaryStructureBuilder.jsx — new
- rontend/src/components/ComponentVersionHistory.jsx — new

## Acceptance Criteria

- [ ] A formula HRA = basic * 0.40 validates and evaluates correctly; HRA = basic * undefined_var returns 422 listing the unknown variable.
- [ ] A circular dependency A = B + 1; B = A + 1 is detected at save time, not at run time.
- [ ] Editing a component increments salaryStructure.version and appends a history entry; historical payslips still reference the snapshot from their run.
- [ ] payroll.worker.js evaluates components in dependency order and stores results as named line items on the payroll document.
- [ ] The live preview endpoint returns component-by-component results within 200ms for structures with up to 30 components.
