## Description

This PR introduces the foundational logic for an AI-Powered Anomaly Detection Engine to spot discrepancies in payroll data automatically.

**Feature:** Added `AnomalyService` which implements isolation forest and Z-score stubs to evaluate historical payroll trends per employee. Added the `Anomaly` Mongoose schema to store flagged records.

---

## Related Issue

* Closes #693

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

* Scaffolded files compile without syntax errors.
* Services can be successfully imported by `payroll.controller.js`.

### Edge cases considered

* Empty payroll arrays handled securely without crashing the ML service.
* Extremely high net salaries safely isolated for HR review.

---

## Screenshots / Videos (required for any UI change)

* [x] Not applicable — no UI change
* [ ] Included below

---

## API Documentation (required for any new/changed backend endpoint)

Internal architecture change: `AnomalyService.detect(payrolls)` is now exposed to the internal `generatePayroll` pipeline.

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

* Frontend dashboard UI is deferred to a future PR.
* Complete ML model training is out of scope for this architectural scaffolding.

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [ ] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
