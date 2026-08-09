## Description

This PR migrates asynchronous workloads (PDF generation, webhook dispatch) to a Message Broker pattern.

**Feature:** Replaced local `EventEmitter` dependencies with a `MessageBroker` service (stubbed for Kafka/RabbitMQ) for domain events like `PAYROLL_FINALIZED`.

---

## Related Issue

* Closes #696

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

* `MessageBroker` successfully stubs the publish interface without blocking the main event loop.
* The `event.service.js` exports the new decoupled interface correctly.

### Edge cases considered

* Message Broker connection drops handled gracefully.
* Backpressure mechanisms built into consumer stubs.

---

## Screenshots / Videos (required for any UI change)

* [x] Not applicable — no UI change
* [ ] Included below

---

## API Documentation (required for any new/changed backend endpoint)

Internal architecture change: `MessageBroker.publish(topic, payload)` replaces local `eventEmitter.emit()` operations.

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

* Kafka/RabbitMQ server provisioning is out of scope.
* External consumer worker microservices will be built in subsequent PRs.

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [ ] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
