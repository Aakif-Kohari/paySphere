## Description

This PR implements a Multi-Currency Treasury engine for real-time FX payouts to global employees.

**Feature:** Added the `FXService` to fetch real-time conversion rates. Expanded the `Employee` schema with target/base currency fields and added a `Treasury` schema to balance multi-currency ledgers.

---

## Related Issue

* Closes #697

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

* `FXService` safely stubs 1:1 conversion for identical currency pairs.
* Treasury balances map initializes correctly across mixed Mongoose data types.

### Edge cases considered

* External Exchange Rate API rate limiting.
* Unknown currency pairs safely rejected.

---

## Screenshots / Videos (required for any UI change)

* [x] Not applicable — no UI change
* [ ] Included below

---

## API Documentation (required for any new/changed backend endpoint)

Internal architecture change: `FXService.getExchangeRate()` added. `Employee` schema modified.

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

* Full integration with external FX providers (e.g., Stripe, TransferWise) out of scope.
* React frontend locale internationalization (i18n) is deferred.

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [ ] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
