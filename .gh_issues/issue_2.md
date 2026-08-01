## Description

The `deleteEmployee` controller deletes related `PayrollUpdate` records and then deletes the `Employee` record in two separate database calls. If the server crashes in between, it leaves data in an inconsistent state. These operations should be wrapped in a MongoDB Session Transaction.

---

## Related Issue

* N/A

---

## Component(s) Affected

* [x] Backend (`server/`)
* [ ] Mobile app (`rhythma_flutter/`)
* [ ] Web app (`web/`)
* [ ] Landing page (`landing-page/`)
* [ ] Docs only (README, CONTRIBUTING, architecture, etc.)
* [ ] CI / tooling

---

## Type of Change

* [x] Bug fix
* [ ] New feature
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
* Verified employee and payroll deletion occurs within a single atomic transaction.

### Edge cases considered

* Employees with no payroll records.

---

## Screenshots / Videos (required for any UI change)

* [x] Not applicable — no UI change
* [ ] Included below

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

* No changes to employee creation or update.

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [x] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
