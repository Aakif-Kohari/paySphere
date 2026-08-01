## Description

When actions like PDF Download or CSV Export fail in `Reports.jsx` and `MonthlyUpdates.jsx`, the app uses native browser `alert()` popups. These block the UI thread and provide a jarring user experience. They should be replaced with non-blocking MUI `<Snackbar>` components.

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
* Confirmed errors trigger MUI Snackbar instead of browser alert.

### Edge cases considered

* Multiple rapid errors.

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

* No changes to successful download logic.

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [x] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
