## Description

This PR introduces the foundational architecture for Blockchain-Backed Immutable Audit Trails, securing finalized payrolls cryptographically.

**Feature:** Added `BlockchainService` for computing Merkle root hashes of finalized payrolls using `crypto`. Added `blockchainTxHash` and `merkleRoot` fields to the `Payroll` schema.

---

## Related Issue

* Closes #694

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

* Hashes are successfully generated via `crypto.createHash`.
* The `Payroll` schema successfully validates the new Web3 fields.

### Edge cases considered

* Hash collisions averted by scoping Merkle generation to unique payroll runs.
* RPC connection failures gracefully bypass blockchain anchoring.

---

## Screenshots / Videos (required for any UI change)

* [x] Not applicable — no UI change
* [ ] Included below

---

## API Documentation (required for any new/changed backend endpoint)

Internal architecture change: `BlockchainService.generateMerkleRoot(payrolls)` and `BlockchainService.anchorToEthereum(merkleRoot)` are now available.

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

* Ethereum smart contract deployment is out of scope.
* Full decentralized node setup is deferred to production infrastructure.

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [ ] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
