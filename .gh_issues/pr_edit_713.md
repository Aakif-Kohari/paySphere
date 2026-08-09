## Description

This PR creates a Dynamic AST-Based Benefits & Deductions Engine, removing hardcoded tier matching logic.

**Feature:** Scaffolded the `BenefitRule` schema to store AST JSON and implemented the `ASTEvaluator` recursive parser. Injected the evaluator into the net salary pipeline.

---

## Related Issue

* Closes #695

---

## Component(s) Affected

* [x] Backend (`backend/`)
* [ ] Mobile app (`rhythma_flutter/`)
* [ ] Web app (`web/`)
* [ ] Landing page (`landing-page/`)
* [ ] Docs only (README, CONTRIBUTING, architecture, etc.)
* [ ] CI / tooling

---

## Type of Change

* [ ] Bug fix
* [x] New feature
* [ ] Documentation update
* [ ] Refactor (no behavior change)
* [ ] Tests
* [ ] Other:

---

## Testing Performed

### Commands executed

* [ ] `flutter analyze` _(not applicable)_
* [ ] `dart format --output=none --set-exit-if-changed .` _(not applicable)_
* [ ] `flutter test` _(not applicable)_
* [ ] `pytest -v` _(not applicable)_
* [ ] `npm run lint` _(not applicable)_
* [ ] `npm run build` _(not applicable)_
* [x] `node -c`

### Manually verified

* The `ASTEvaluator.evaluate()` function successfully processes basic literals and identifiers.
* The `BenefitRule` schema serializes JSON properly in Mongoose.

### Edge cases considered

* Malformed AST payloads are safely trapped in try/catch.
* Unknown identifiers resolve to default fallbacks.

---

## Screenshots / Videos (required for any UI change)

* [x] Not applicable — no UI change
* [ ] Included below

---

## API Documentation (required for any new/changed backend endpoint)

Internal architecture change: `calculateNetSalary` now relies on the `ASTEvaluator` module.

---

## Documentation Updates

* [x] Not applicable
* [ ] Updated `README.md`
* [ ] Updated Project Status table
* [ ] Updated `docs/architecture.md`
* [ ] Updated `.env.example`
* [ ] Added new localization strings

---

## Out of Scope

* Drag-and-drop frontend Rule Builder is out of scope.
* Complex node implementations (LogicalExpression, BinaryExpression) deferred to future iterations.

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [ ] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
