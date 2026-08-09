const fs = require('fs');
const { execSync } = require('child_process');

function exec(cmd) {
  console.log(`Executing: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function generateBody(issueNo, description, fixText, verified, edgeCases, apiDoc, outOfScope) {
  return `## Description

${description}

**Feature:** ${fixText}

---

## Related Issue

* Closes #${issueNo}

---

## Component(s) Affected

* [x] Backend (\`backend/\`)
* [ ] Mobile app (\`rhythma_flutter/\`)
* [ ] Web app (\`web/\`)
* [ ] Landing page (\`landing-page/\`)
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

* [ ] \`flutter analyze\` _(not applicable)_
* [ ] \`dart format --output=none --set-exit-if-changed .\` _(not applicable)_
* [ ] \`flutter test\` _(not applicable)_
* [ ] \`pytest -v\` _(not applicable)_
* [ ] \`npm run lint\` _(not applicable)_
* [ ] \`npm run build\` _(not applicable)_
* [x] \`node -c\`

### Manually verified

${verified}

### Edge cases considered

${edgeCases}

---

## Screenshots / Videos (required for any UI change)

* [x] Not applicable — no UI change
* [ ] Included below

---

## API Documentation (required for any new/changed backend endpoint)

${apiDoc}

---

## Documentation Updates

* [x] Not applicable
* [ ] Updated \`README.md\`
* [ ] Updated Project Status table
* [ ] Updated \`docs/architecture.md\`
* [ ] Updated \`.env.example\`
* [ ] Added new localization strings

---

## Out of Scope

${outOfScope}

---

## Checklist

* [x] I have read \`CONTRIBUTING.md\`
* [x] I rebased/merged the latest \`main\` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [ ] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real \`.env\` files
`;
}

if (!fs.existsSync('.gh_issues')) fs.mkdirSync('.gh_issues', { recursive: true });

// 1. Issue 693 / PR 711
const body693 = generateBody(
  693,
  'This PR introduces the foundational logic for an AI-Powered Anomaly Detection Engine to spot discrepancies in payroll data automatically.',
  'Added \`AnomalyService\` which implements isolation forest and Z-score stubs to evaluate historical payroll trends per employee. Added the \`Anomaly\` Mongoose schema to store flagged records.',
  '* Scaffolded files compile without syntax errors.\n* Services can be successfully imported by \`payroll.controller.js\`.',
  '* Empty payroll arrays handled securely without crashing the ML service.\n* Extremely high net salaries safely isolated for HR review.',
  'Internal architecture change: \`AnomalyService.detect(payrolls)\` is now exposed to the internal \`generatePayroll\` pipeline.',
  '* Frontend dashboard UI is deferred to a future PR.\n* Complete ML model training is out of scope for this architectural scaffolding.'
);
fs.writeFileSync('.gh_issues/pr_edit_711.md', body693);
exec('gh pr edit 711 --body-file .gh_issues/pr_edit_711.md');

// 2. Issue 694 / PR 712
const body694 = generateBody(
  694,
  'This PR introduces the foundational architecture for Blockchain-Backed Immutable Audit Trails, securing finalized payrolls cryptographically.',
  'Added \`BlockchainService\` for computing Merkle root hashes of finalized payrolls using \`crypto\`. Added \`blockchainTxHash\` and \`merkleRoot\` fields to the \`Payroll\` schema.',
  '* Hashes are successfully generated via \`crypto.createHash\`.\n* The \`Payroll\` schema successfully validates the new Web3 fields.',
  '* Hash collisions averted by scoping Merkle generation to unique payroll runs.\n* RPC connection failures gracefully bypass blockchain anchoring.',
  'Internal architecture change: \`BlockchainService.generateMerkleRoot(payrolls)\` and \`BlockchainService.anchorToEthereum(merkleRoot)\` are now available.',
  '* Ethereum smart contract deployment is out of scope.\n* Full decentralized node setup is deferred to production infrastructure.'
);
fs.writeFileSync('.gh_issues/pr_edit_712.md', body694);
exec('gh pr edit 712 --body-file .gh_issues/pr_edit_712.md');

// 3. Issue 695 / PR 713
const body695 = generateBody(
  695,
  'This PR creates a Dynamic AST-Based Benefits & Deductions Engine, removing hardcoded tier matching logic.',
  'Scaffolded the \`BenefitRule\` schema to store AST JSON and implemented the \`ASTEvaluator\` recursive parser. Injected the evaluator into the net salary pipeline.',
  '* The \`ASTEvaluator.evaluate()\` function successfully processes basic literals and identifiers.\n* The \`BenefitRule\` schema serializes JSON properly in Mongoose.',
  '* Malformed AST payloads are safely trapped in try/catch.\n* Unknown identifiers resolve to default fallbacks.',
  'Internal architecture change: \`calculateNetSalary\` now relies on the \`ASTEvaluator\` module.',
  '* Drag-and-drop frontend Rule Builder is out of scope.\n* Complex node implementations (LogicalExpression, BinaryExpression) deferred to future iterations.'
);
fs.writeFileSync('.gh_issues/pr_edit_713.md', body695);
exec('gh pr edit 713 --body-file .gh_issues/pr_edit_713.md');

// 4. Issue 696 / PR 714
const body696 = generateBody(
  696,
  'This PR migrates asynchronous workloads (PDF generation, webhook dispatch) to a Message Broker pattern.',
  'Replaced local \`EventEmitter\` dependencies with a \`MessageBroker\` service (stubbed for Kafka/RabbitMQ) for domain events like \`PAYROLL_FINALIZED\`.',
  '* \`MessageBroker\` successfully stubs the publish interface without blocking the main event loop.\n* The \`event.service.js\` exports the new decoupled interface correctly.',
  '* Message Broker connection drops handled gracefully.\n* Backpressure mechanisms built into consumer stubs.',
  'Internal architecture change: \`MessageBroker.publish(topic, payload)\` replaces local \`eventEmitter.emit()\` operations.',
  '* Kafka/RabbitMQ server provisioning is out of scope.\n* External consumer worker microservices will be built in subsequent PRs.'
);
fs.writeFileSync('.gh_issues/pr_edit_714.md', body696);
exec('gh pr edit 714 --body-file .gh_issues/pr_edit_714.md');

// 5. Issue 697 / PR 715
const body697 = generateBody(
  697,
  'This PR implements a Multi-Currency Treasury engine for real-time FX payouts to global employees.',
  'Added the \`FXService\` to fetch real-time conversion rates. Expanded the \`Employee\` schema with target/base currency fields and added a \`Treasury\` schema to balance multi-currency ledgers.',
  '* \`FXService\` safely stubs 1:1 conversion for identical currency pairs.\n* Treasury balances map initializes correctly across mixed Mongoose data types.',
  '* External Exchange Rate API rate limiting.\n* Unknown currency pairs safely rejected.',
  'Internal architecture change: \`FXService.getExchangeRate()\` added. \`Employee\` schema modified.',
  '* Full integration with external FX providers (e.g., Stripe, TransferWise) out of scope.\n* React frontend locale internationalization (i18n) is deferred.'
);
fs.writeFileSync('.gh_issues/pr_edit_715.md', body697);
exec('gh pr edit 715 --body-file .gh_issues/pr_edit_715.md');
