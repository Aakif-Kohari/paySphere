## Description

The `DashboardOverview` component maps over all filtered employees and renders an `EmployeeCard` for each one. For companies with hundreds of employees, this causes severe DOM bloat, UI clutter, and lagging. It should implement pagination similar to the Employee Management tab.

---

## Related Issue

* N/A

---

## Component(s) Affected

* [ ] Backend (`server/`)
* [ ] Mobile app (`rhythma_flutter/`)
* [x] Web app (`web/`)
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

* [ ] `npm test`
* [ ] `npm run lint`
* [ ] `npm run build`
* [x] Manual verification

### Manually verified

* Verified behavior locally.
* Confirmed dashboard renders smoothly with pagination for a large number of employees.

### Edge cases considered

* Zero employees, exactly 1 page of employees.

---

## Screenshots / Videos (required for any UI change)

* [ ] Not applicable — no UI change
* [x] Included below

---

## API Documentation (required for any new/changed backend endpoint)

Not applicable. This PR does not modify backend endpoints or request/response models.

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

* No changes to Employee Management tab.

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [x] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
