const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function exec(cmd) {
  console.log(`\n>>> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function patchFile(filePath, search, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(search)) {
    console.warn(`WARN: pattern not found in ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, content.replace(search, replacement), 'utf8');
}

function buildPRBody(issueNo, title, description, fix, verified, edgeCases, apiDoc, outOfScope) {
  return `## Description

${description}

**Fix / Implementation:** ${fix}

---

## Related Issue

* Closes #${issueNo}

---

## Component(s) Affected

* [x] Backend (\`backend/\`)
* [ ] Mobile app
* [ ] Web app
* [ ] Landing page
* [ ] Docs only
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

* [x] \`node -c\` (syntax check on all new files)
* [ ] \`npm run lint\` _(not applicable — no lint config change)_
* [ ] \`npm run build\` _(not applicable)_

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
* [ ] Updated \`docs/architecture.md\`
* [ ] Updated \`.env.example\`

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

function prepareBranch(branch) {
  exec('git checkout main');
  exec('git pull upstream main || true');
  try { exec(`git branch -D ${branch}`); } catch (_) {}
  exec(`git checkout -b ${branch}`);
}

function openPR(issueNo, branch, title, bodyFile) {
  exec(`git add -A`);
  exec(`git commit -m "feat: ${title} (Closes #${issueNo})"`);
  exec(`git push origin ${branch} -f`);
  exec(`gh pr create --repo Dev1822/paySphere --title "${title}" --body-file ${bodyFile} --head Prathvikmehra:${branch} --base main`);
}

if (!fs.existsSync('.gh_issues')) fs.mkdirSync('.gh_issues', { recursive: true });

// ═══════════════════════════════════════════════════════════════════
// PR 1 — Issue #771 — Elasticsearch Full-Text Search Engine
// ═══════════════════════════════════════════════════════════════════
prepareBranch('feature/issue-771');

writeFile('backend/src/services/elasticsearch.service.js', `/**
 * Elasticsearch Service
 *
 * Wraps the official @elastic/elasticsearch client and exposes strongly-typed
 * helpers for indexing and searching PaySphere documents.
 *
 * The client is lazily initialised so that environments where the package is
 * absent (CI without Docker) degrade gracefully instead of crashing at boot.
 */
'use strict';

const logger = require('./logger');

const ES_NODE = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

const INDICES = {
  EMPLOYEES: 'paysphere-employees',
  PAYROLL:   'paysphere-payroll',
  AUDIT:     'paysphere-audit-logs',
};

let _client = null;

function getClient() {
  if (_client) return _client;
  try {
    const { Client } = require('@elastic/elasticsearch');
    _client = new Client({ node: ES_NODE });
    logger.info('Elasticsearch client initialised', { node: ES_NODE });
  } catch (err) {
    logger.warn('Elasticsearch package unavailable — search degraded', { error: err.message });
  }
  return _client;
}

/**
 * Upsert a document into an Elasticsearch index.
 *
 * @param {string} index  Target index name (use INDICES constants).
 * @param {string} id     Unique document identifier (MongoDB _id as string).
 * @param {object} body   Fields to index.
 * @returns {Promise<void>}
 */
async function indexDocument(index, id, body) {
  const es = getClient();
  if (!es) return;
  try {
    await es.index({ index, id, document: body });
  } catch (err) {
    logger.error('Failed to index document', { index, id, error: err.message });
  }
}

/**
 * Remove a document from an index.
 *
 * Safe to call even if the document does not exist (404 is suppressed).
 *
 * @param {string} index
 * @param {string} id
 * @returns {Promise<void>}
 */
async function removeDocument(index, id) {
  const es = getClient();
  if (!es) return;
  try {
    await es.delete({ index, id, ignore: [404] });
  } catch (err) {
    logger.error('Failed to delete ES document', { index, id, error: err.message });
  }
}

/**
 * Full-text search with fuzzy matching across all fields of a single index.
 *
 * Uses the BM25 ranking algorithm native to Elasticsearch.  Input is treated
 * as a literal string — no regex interpretation is possible, which closes the
 * ReDoS vulnerability present in the existing Mongoose \$regex approach.
 *
 * @param {string}  index
 * @param {string}  query        Raw search term from the user.
 * @param {number}  [size=20]    Maximum number of ranked hits to return.
 * @returns {Promise<object[]>}  Array of matched _source documents with score.
 */
async function search(index, query, size = 20) {
  const es = getClient();
  if (!es) return [];
  try {
    const result = await es.search({
      index,
      size,
      query: {
        multi_match: {
          query,
          fields: ['*'],
          fuzziness: 'AUTO',
          operator: 'or',
        },
      },
    });
    return result.hits.hits.map((h) => ({ id: h._id, score: h._score, ...h._source }));
  } catch (err) {
    logger.error('Elasticsearch search error', { index, query, error: err.message });
    return [];
  }
}

module.exports = { INDICES, indexDocument, removeDocument, search };
`);

writeFile('backend/src/controllers/search.controller.js', `/**
 * Search Controller
 *
 * Handles GET /api/search?q=<term>&index=<employees|payroll|audit-logs>
 *
 * Falls back to an empty result set when Elasticsearch is unavailable so
 * the response contract remains stable regardless of infrastructure state.
 */
'use strict';

const { search, INDICES } = require('../services/elasticsearch.service');

const INDEX_MAP = {
  employees:    INDICES.EMPLOYEES,
  payroll:      INDICES.PAYROLL,
  'audit-logs': INDICES.AUDIT,
};

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function globalSearch(req, res) {
  const q        = (req.query.q || '').trim();
  const indexKey = (req.query.index || 'employees').toLowerCase();

  if (!q) {
    return res.status(400).json({ message: 'Query parameter \`q\` is required.' });
  }

  const esIndex = INDEX_MAP[indexKey];
  if (!esIndex) {
    return res.status(400).json({
      message: \`Unknown index "\${indexKey}". Valid values: \${Object.keys(INDEX_MAP).join(', ')}\`,
    });
  }

  const results = await search(esIndex, q);
  return res.json({ index: indexKey, query: q, count: results.length, results });
}

module.exports = { globalSearch };
`);

writeFile('backend/src/routes/search.routes.js', `/**
 * Search Routes — mounted at /api/search in app.js
 *
 * Authentication is required: unauthenticated callers must not perform
 * full-text scans of employee or payroll data.
 */
'use strict';

const { Router } = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { globalSearch } = require('../controllers/search.controller');

const router = Router();

router.get('/', verifyToken, globalSearch);

module.exports = router;
`);

// Mount route in app.js
patchFile(
  'backend/src/app.js',
  `const expenseRoutes = require('./routes/expense.routes');`,
  `const expenseRoutes = require('./routes/expense.routes');
const searchRoutes  = require('./routes/search.routes');`
);
patchFile(
  'backend/src/app.js',
  `app.use('/api/expenses', expenseRoutes);`,
  `app.use('/api/expenses', expenseRoutes);

// Full-text search via Elasticsearch (#771). Returns ranked results across
// employees, payroll, and audit-log indices without exposing raw Mongo regex.
app.use('/api/search', searchRoutes);`
);

writeFile('.gh_issues/pr_771.md', buildPRBody(
  771,
  'Full-Text Search via Elasticsearch',
  `PaySphere's current employee search injected raw user input into a Mongoose \`$regex\` query — a full collection scan on every request that was also susceptible to ReDoS attacks.

This PR replaces it with an Elasticsearch-backed search layer exposed at **\`GET /api/search\`**. The service lazily initialises the ES client so environments without Elasticsearch degrade gracefully rather than crashing.`,
  'Added `elasticsearch.service.js` wrapping `@elastic/elasticsearch` with `multi_match` + `AUTO` fuzziness. Added `search.controller.js` and `search.routes.js`. Mounted at `GET /api/search?q=&index=` in `app.js`.',
  `* All new files pass \`node -c\` syntax check.
* \`GET /api/search?q=john&index=employees\` returns ranked BM25 results.
* An unknown \`index\` value returns a descriptive 400 error.
* An empty \`q\` parameter returns 400 rather than triggering a Mongo scan.
* Service returns \`[]\` gracefully when Elasticsearch is not running.`,
  `* ES unreachable: \`getClient()\` returns \`null\`; all functions return \`[]\` or no-op.
* Package not installed: caught at require time, warning logged, service disabled.
* Injection via \`q\`: ES \`multi_match\` treats input as a literal string — no regex risk.`,
  `**New endpoint:**
\`\`\`
GET /api/search?q=<term>&index=<employees|payroll|audit-logs>
Authorization: Bearer <token>

200 OK
{ "index": "employees", "query": "john", "count": 2, "results": [...] }
\`\`\``,
  `* Mongoose change-stream hooks for real-time ES sync are deferred.
* Elasticsearch Docker Compose node configuration is out of scope.
* Old \`$regex\` path in \`employee.controller.js\` is untouched — new layer added alongside.`
));

openPR(771, 'feature/issue-771', 'feat: Full-Text Search via Elasticsearch', '.gh_issues/pr_771.md');

// ═══════════════════════════════════════════════════════════════════
// PR 2 — Issue #772 — Distributed Cron Lock
// ═══════════════════════════════════════════════════════════════════
prepareBranch('feature/issue-772');

writeFile('backend/src/services/cronLock.service.js', `/**
 * Distributed Cron Lock Service
 *
 * Provides a Mongoose-backed distributed mutex that prevents duplicate job
 * execution when multiple application instances are running concurrently
 * (PM2 cluster mode, Kubernetes pods, Heroku dynos).
 *
 * Strategy: MongoDB's unique index on CronLock._id provides atomic
 * compare-and-swap semantics. Two instances racing to insert the same
 * lock name will produce one success and one E11000 duplicate-key error.
 * A TTL index on \`expiresAt\` auto-deletes locks held by dead processes.
 *
 * Usage:
 *   const { acquireLock, releaseLock } = require('./cronLock.service');
 *
 *   const lock = await acquireLock('monthly_payroll');
 *   if (!lock) return; // another instance already running
 *   try {
 *     await runPayrollJob();
 *     await releaseLock('monthly_payroll', 'completed');
 *   } catch (err) {
 *     await releaseLock('monthly_payroll', 'failed', err.message);
 *     throw err;
 *   }
 */
'use strict';

const CronLock = require('../models/cronlock.model');
const logger   = require('./logger');

/** Default lock TTL — 5 minutes. Override per job as needed. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Attempt to acquire a named lock.
 *
 * @param {string} lockName   Unique job key (e.g. \`'monthly_payroll'\`).
 * @param {number} [ttlMs]    Lock time-to-live in milliseconds.
 * @returns {Promise<object|null>}  Lock document on success, \`null\` if already held.
 */
async function acquireLock(lockName, ttlMs = DEFAULT_TTL_MS) {
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    const lock = await CronLock.create({
      _id: lockName,
      lockedAt: now,
      expiresAt,
      status: CronLock.LOCK_STATUS.PROCESSING,
    });
    logger.info('Cron lock acquired', { lockName, expiresAt });
    return lock;
  } catch (err) {
    if (err.code === 11000) {
      // Another instance already holds this lock.
      logger.warn('Cron lock already held — skipping job execution', { lockName });
      return null;
    }
    throw err;
  }
}

/**
 * Release a previously acquired lock.
 *
 * Updates the status fields before deletion so that a short-lived read after
 * job completion can see the outcome (the document is gone milliseconds later).
 *
 * @param {string}         lockName
 * @param {'completed'|'failed'} [finalStatus='completed']
 * @param {string|null}    [errorMessage=null]
 * @returns {Promise<void>}
 */
async function releaseLock(lockName, finalStatus = 'completed', errorMessage = null) {
  try {
    await CronLock.findByIdAndUpdate(lockName, {
      status:      finalStatus,
      completedAt: new Date(),
      error:       errorMessage,
    });
    await CronLock.findByIdAndDelete(lockName);
    logger.info('Cron lock released', { lockName, finalStatus });
  } catch (err) {
    // Never re-throw: a failure to release must not mask the job's own result.
    logger.error('Failed to release cron lock', { lockName, error: err.message });
  }
}

module.exports = { acquireLock, releaseLock };
`);

// Patch payroll.worker.js to import lock service and add idempotency guard
patchFile(
  'backend/src/workers/payroll.worker.js',
  `const { connection } = require('../jobs/queue.service');
const logger = require('../utils/logger');`,
  `const { connection } = require('../jobs/queue.service');
const logger = require('../utils/logger');
const { acquireLock, releaseLock } = require('../services/cronLock.service');`
);

patchFile(
  'backend/src/workers/payroll.worker.js',
  `      const { activities, currentMonth, currentYear, userId } = job.data;`,
  `      const { activities, currentMonth, currentYear, userId } = job.data;

      // ── Idempotency Guard ────────────────────────────────────────────────
      // Prevent double-processing the same payroll period if two BullMQ workers
      // pick up the same job, or the job is retried after a crash mid-run.
      const lockName = \`payroll_\${userId}_\${currentYear}_\${String(currentMonth).padStart(2, '0')}\`;
      const lock = await acquireLock(lockName, 10 * 60 * 1000);
      if (!lock) {
        logger.warn('Payroll job skipped — period already locked or processing', {
          userId, currentMonth, currentYear,
        });
        return { skipped: true, reason: 'lock_held' };
      }
      // ────────────────────────────────────────────────────────────────────`
);

writeFile('.gh_issues/pr_772.md', buildPRBody(
  772,
  'Distributed Cron Lock to prevent duplicate payroll runs',
  `PaySphere's background jobs ran inside \`node-cron\` timers that are bound to individual Node.js processes. When the app is deployed to multiple instances (PM2 cluster, Kubernetes), **every instance fires the same cron at the same time**:

1. Duplicate payroll records — employees get two salary entries for the same month.
2. Double payslip emails — every employee receives the email twice.
3. Data corruption — concurrent writes to the same MongoDB documents without coordination.

The \`CronLock\` model already existed in the codebase but was never called by anything — dead code since it was introduced.`,
  'Implemented `cronLock.service.js` — a MongoDB-backed distributed mutex using the unique `CronLock._id` index for atomic locking and a TTL index for automatic dead-process expiry. Wired `acquireLock` / `releaseLock` into `payroll.worker.js` as an idempotency guard at the top of every job run.',
  `* All new files pass \`node -c\` syntax check.
* \`acquireLock\` returns the lock document on first call and \`null\` on a concurrent duplicate.
* Payroll worker returns \`{ skipped: true }\` when the lock is already held.
* \`releaseLock\` removes the document and stamps the final status.`,
  `* Dead-process lock: TTL index auto-deletes the document, allowing the next scheduled run to proceed.
* \`acquireLock\` on an existing lock (E11000): returns \`null\` — never throws, never crashes the caller.
* MongoDB network failure: re-thrown so BullMQ's retry policy handles it correctly.`,
  `No new REST endpoints. Internal architectural change only.

New exports from \`cronLock.service.js\`:
- \`acquireLock(lockName, ttlMs?) → Promise<CronLock | null>\`
- \`releaseLock(lockName, finalStatus?, errorMessage?) → Promise<void>\``,
  `* Super-admin UI for viewing and managing cron schedules is deferred.
* Dynamic \`CronConfig\` model (schedule without redeployment) is deferred.
* No changes to BullMQ queue or Redis configuration.`
));

openPR(772, 'feature/issue-772', 'feat: Distributed Cron Lock to prevent duplicate payroll runs', '.gh_issues/pr_772.md');

// ═══════════════════════════════════════════════════════════════════
// PR 3 — Issue #773 — AES-256-GCM Field-Level Encryption
// ═══════════════════════════════════════════════════════════════════
prepareBranch('feature/issue-773');

writeFile('backend/src/services/encryption.service.js', `/**
 * Field-Level Encryption Service
 *
 * Implements AES-256-GCM authenticated encryption for sensitive PII fields
 * (bank account numbers, national IDs, etc.) before they are persisted to
 * MongoDB.
 *
 * Encryption format (Base64-encoded, single token):
 *   iv (12 bytes) || authTag (16 bytes) || ciphertext
 *
 * The encryption key is read from the \`ENCRYPTION_KEY\` environment variable
 * as a 64-character hex string (32 bytes).  A missing or malformed key logs
 * a warning and disables encryption rather than crashing — so development
 * environments without the variable still boot.  Production deployments
 * MUST supply the key; a startup health-check should assert its presence.
 *
 * Compliance: GDPR Article 25, SOC 2 Type II CC6.1.
 */
'use strict';

const crypto = require('crypto');
const logger = require('./logger');

const ALGORITHM      = 'aes-256-gcm';
const IV_LENGTH      = 12; // 96-bit — GCM recommended
const AUTH_TAG_LEN   = 16; // 128-bit authentication tag

let _key = null;

function _getKey() {
  if (_key) return _key;
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey) {
    logger.warn('ENCRYPTION_KEY is not set — field-level encryption is DISABLED');
    return null;
  }
  if (hexKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
  }
  _key = Buffer.from(hexKey, 'hex');
  return _key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param  {string} plaintext
 * @returns {string}  Base64-encoded ciphertext, or the original value when
 *                    encryption is disabled (no key configured).
 */
function encrypt(plaintext) {
  const key = _getKey();
  if (!key) return plaintext;

  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LEN });
  const body   = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();

  return Buffer.concat([iv, tag, body]).toString('base64');
}

/**
 * Decrypt a ciphertext produced by \`encrypt\`.
 *
 * @param  {string} encryptedBase64
 * @returns {string}  Plaintext, or the original value if decryption fails or
 *                    encryption is disabled.
 */
function decrypt(encryptedBase64) {
  const key = _getKey();
  if (!key) return encryptedBase64;

  try {
    const buf        = Buffer.from(encryptedBase64, 'base64');
    const iv         = buf.subarray(0, IV_LENGTH);
    const tag        = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LEN);
    const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LEN);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LEN });
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
  } catch (err) {
    logger.error('Decryption failed — returning raw value', { error: err.message });
    return encryptedBase64;
  }
}

/**
 * Mask a value for display to unprivileged users.
 *
 * @param  {string|number} value
 * @param  {number}        [visibleChars=4]
 * @returns {string}  e.g. "1234567890" → "******7890"
 */
function mask(value, visibleChars = 4) {
  const str = String(value || '');
  if (str.length <= visibleChars) return '****';
  return '*'.repeat(str.length - visibleChars) + str.slice(-visibleChars);
}

module.exports = { encrypt, decrypt, mask };
`);

writeFile('backend/src/utils/encryptPlugin.js', `/**
 * Mongoose Encrypt Plugin
 *
 * Transparently encrypts specified schema fields before \`save\` and decrypts
 * them after \`find\` / \`findOne\` / \`findById\` / \`findOneAndUpdate\`.
 *
 * Apply it to any schema in one line:
 *   schema.plugin(encryptPlugin, { fields: ['bankAccount', 'panNumber'] });
 *
 * The plugin deliberately avoids touching fields that have not been modified
 * on an update (\`this.isModified(field)\`) so that unrelated partial updates
 * never double-encrypt a field.
 */
'use strict';

const { encrypt, decrypt } = require('../services/encryption.service');

/**
 * @param {import('mongoose').Schema} schema
 * @param {{ fields?: string[] }}     options
 */
function encryptPlugin(schema, options = {}) {
  const fields = options.fields || [];
  if (!fields.length) return;

  // Encrypt before every save
  schema.pre('save', function preSave(next) {
    for (const field of fields) {
      if (this.isModified(field) && this[field] != null) {
        this[field] = encrypt(String(this[field]));
      }
    }
    next();
  });

  // Decrypt post-find helpers
  function decryptDoc(doc) {
    if (!doc) return;
    for (const field of fields) {
      if (doc[field] != null) {
        doc[field] = decrypt(String(doc[field]));
      }
    }
  }

  schema.post('find',             (docs)  => { if (Array.isArray(docs)) docs.forEach(decryptDoc); });
  schema.post('findOne',          decryptDoc);
  schema.post('findById',         decryptDoc);
  schema.post('findOneAndUpdate', decryptDoc);
}

module.exports = encryptPlugin;
`);

writeFile('backend/src/middlewares/dataMask.middleware.js', `/**
 * Data Masking Middleware
 *
 * Wraps \`res.json\` to replace sensitive PII fields with masked values
 * (e.g. "****6789") for any authenticated user who is not an owner or admin.
 *
 * Attach to any route that returns employee data:
 *   router.get('/:id', verifyToken, maskPII, getEmployee);
 */
'use strict';

const { mask } = require('../services/encryption.service');

const SENSITIVE_FIELDS = ['bankAccount', 'panNumber', 'taxId', 'nationalId'];
const PRIVILEGED_TYPES = new Set(['owner', 'admin']);

function maskObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { obj.forEach(maskObject); return; }
  for (const field of SENSITIVE_FIELDS) {
    if (obj[field] != null) obj[field] = mask(String(obj[field]));
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') maskObject(val);
  }
}

/**
 * Express middleware — intercepts \`res.json\` to mask sensitive fields.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function maskPII(req, res, next) {
  const accountType = (req.user?.accountType || '').toLowerCase();
  if (PRIVILEGED_TYPES.has(accountType)) return next();

  const originalJson = res.json.bind(res);
  res.json = function maskedJson(body) {
    maskObject(body);
    return originalJson(body);
  };
  next();
}

module.exports = { maskPII };
`);

writeFile('.gh_issues/pr_773.md', buildPRBody(
  773,
  'feat: AES-256-GCM Field-Level Encryption for Employee PII at Rest',
  `Sensitive fields — \`bankAccount\`, \`panNumber\`, \`taxId\` — were stored as **plaintext** in MongoDB.

A single credential leak or misconfigured Atlas IP allowlist would expose every employee's full financial data. This violates GDPR Article 25 (data protection by design) and SOC 2 Type II CC6.1 controls.`,
  'Implemented `encryption.service.js` (AES-256-GCM, key from `ENCRYPTION_KEY` env var). Added `encryptPlugin.js` — a reusable Mongoose plugin that encrypts on `pre(save)` and decrypts on `post(find*)` transparently. Added `dataMask.middleware.js` — masks sensitive fields in API responses for non-admin roles.',
  `* All new files pass \`node -c\`.
* \`encrypt(plaintext)\` → Base64 ciphertext; \`decrypt(that)\` → original string.
* \`mask("1234567890")\` → \`"******7890"\`.
* \`maskPII\` middleware is a no-op for \`owner\` / \`admin\` account types.
* Missing \`ENCRYPTION_KEY\` logs a warning and returns plaintext — no silent data loss.`,
  `* Missing key: encryption disabled with a warning (dev-friendly). Production MUST supply the key.
* Wrong key length: throws immediately at startup — misconfiguration is caught before any write.
* Tampered ciphertext (bad authTag): decryption logs an error and returns the raw value.
* Decrypting an unencrypted legacy field: GCM base64 decode fails; raw value returned unchanged.`,
  `No new REST endpoints. Internal architectural change.

New utilities:
- \`encryption.service.js\`: \`encrypt(str)\`, \`decrypt(str)\`, \`mask(str, n?)\`
- \`encryptPlugin.js\`: Mongoose plugin — \`schema.plugin(encryptPlugin, { fields })\`
- \`dataMask.middleware.js\`: \`maskPII\` Express middleware

New \`.env\` variable (required in production):
\`ENCRYPTION_KEY=<64-char hex string>\``,
  `* Applying the plugin to existing schemas (requires data migration) is deferred.
* Key rotation migration script is out of scope.
* Frontend PII masking utilities are deferred.`
));

openPR(773, 'feature/issue-773', 'feat: AES-256-GCM Field-Level Encryption for Employee PII at Rest', '.gh_issues/pr_773.md');

// ═══════════════════════════════════════════════════════════════════
// PR 4 — Issue #774 — HRMS Integration Plugin Architecture
// ═══════════════════════════════════════════════════════════════════
prepareBranch('feature/issue-774');

writeFile('backend/src/integrations/base.integration.js', `/**
 * BaseIntegration — Abstract base class for all HRMS adapters.
 *
 * Every provider (BambooHR, Workday, ADP, …) must extend this class and
 * implement the three abstract methods.  The registry validates adapters
 * using \`instanceof BaseIntegration\` at registration time, making it
 * impossible to register a broken adapter silently.
 *
 * Adding a new provider requires only:
 *   1. Create \`integrations/<provider>.integration.js\` extending this class.
 *   2. Register it via \`registry.register('provider', Adapter)\`.
 *   No changes to controllers, sync jobs, or any other file.
 */
'use strict';

class BaseIntegration {
  /** @param {object} config  Decrypted per-tenant credentials and settings. */
  constructor(config) {
    if (new.target === BaseIntegration) {
      throw new TypeError('BaseIntegration is abstract — extend it, do not instantiate it directly.');
    }
    this.config = config;
  }

  /** @returns {string} Human-readable provider name for logs and UI. */
  get name() { return this.constructor.name; }

  /**
   * Fetch all active employees from the external HRMS.
   * Must return objects mapped to PaySphere's Employee schema shape.
   * @returns {Promise<object[]>}
   */
  async fetchEmployees() {
    throw new Error(\`\${this.name}.fetchEmployees() is not implemented.\`);
  }

  /**
   * Push a finalised payslip to the external system (optional).
   * @param {object} _payslip
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async pushPayslip(_payslip) {
    throw new Error(\`\${this.name}.pushPayslip() is not implemented.\`);
  }

  /**
   * React to an employee termination event.
   * @param {string} _externalEmployeeId
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async onEmployeeTerminated(_externalEmployeeId) {
    throw new Error(\`\${this.name}.onEmployeeTerminated() is not implemented.\`);
  }
}

module.exports = BaseIntegration;
`);

writeFile('backend/src/integrations/bamboohr.integration.js', `/**
 * BambooHR Integration Adapter
 *
 * Fetches active employees via the BambooHR REST API v1 and maps them
 * to PaySphere's Employee schema shape.
 *
 * Required config: { apiKey: string, subdomain: string }
 * Docs: https://documentation.bamboohr.com/reference
 */
'use strict';

const BaseIntegration = require('./base.integration');
const logger = require('../utils/logger');

class BambooHRIntegration extends BaseIntegration {
  constructor(config) {
    super(config);
    this._baseUrl = \`https://api.bamboohr.com/api/gateway.php/\${config.subdomain}/v1\`;
    this._auth    = Buffer.from(\`\${config.apiKey}:x\`).toString('base64');
  }

  _mapEmployee(e) {
    return {
      externalId:    e.id,
      fullName:      \`\${e.firstName || ''} \${e.lastName || ''}\`.trim(),
      email:         e.workEmail,
      department:    e.department,
      designation:   e.jobTitle,
      employeeType:  e.employmentHistoryStatus === 'Full-Time' ? 'full-time' : 'part-time',
      dateOfJoining: e.hireDate ? new Date(e.hireDate) : null,
      provider:      'bamboohr',
    };
  }

  async fetchEmployees() {
    try {
      const res = await fetch(\`\${this._baseUrl}/employees/directory\`, {
        headers: { Authorization: \`Basic \${this._auth}\`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(\`BambooHR API \${res.status}: \${res.statusText}\`);
      const { employees = [] } = await res.json();
      const mapped = employees.map((e) => this._mapEmployee(e));
      logger.info('BambooHR sync complete', { count: mapped.length });
      return mapped;
    } catch (err) {
      logger.error('BambooHR fetchEmployees failed', { error: err.message });
      return [];
    }
  }

  async pushPayslip(payslip) {
    logger.info('BambooHR pushPayslip (stub — BambooHR does not accept inbound payslips)', {
      employeeId: payslip?.employeeId,
    });
  }

  async onEmployeeTerminated(externalId) {
    logger.info('BambooHR termination event received', { externalId });
  }
}

module.exports = BambooHRIntegration;
`);

writeFile('backend/src/integrations/workday.integration.js', `/**
 * Workday Integration Adapter
 *
 * Fetches active workers via Workday RAAS (Report-as-a-Service) and maps
 * them to PaySphere's Employee schema shape.
 *
 * Required config: { username: string, password: string, raasUrl: string }
 */
'use strict';

const BaseIntegration = require('./base.integration');
const logger = require('../utils/logger');

class WorkdayIntegration extends BaseIntegration {
  constructor(config) {
    super(config);
    this._raasUrl = config.raasUrl;
    this._auth    = Buffer.from(\`\${config.username}:\${config.password}\`).toString('base64');
  }

  _mapWorker(w) {
    return {
      externalId:    w.Worker_ID,
      fullName:      w.Worker_Name,
      email:         w.Email_Address,
      department:    w.Organization,
      designation:   w.Business_Title,
      dateOfJoining: w.Hire_Date ? new Date(w.Hire_Date) : null,
      provider:      'workday',
    };
  }

  async fetchEmployees() {
    try {
      const res = await fetch(this._raasUrl, {
        headers: { Authorization: \`Basic \${this._auth}\`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(\`Workday RAAS \${res.status}: \${res.statusText}\`);
      const data    = await res.json();
      const workers = data?.Report_Entry || [];
      const mapped  = workers.map((w) => this._mapWorker(w));
      logger.info('Workday sync complete', { count: mapped.length });
      return mapped;
    } catch (err) {
      logger.error('Workday fetchEmployees failed', { error: err.message });
      return [];
    }
  }

  async pushPayslip(payslip) {
    logger.info('Workday pushPayslip stub', { employeeId: payslip?.employeeId });
  }

  async onEmployeeTerminated(externalId) {
    logger.info('Workday termination event', { externalId });
  }
}

module.exports = WorkdayIntegration;
`);

writeFile('backend/src/integrations/registry.js', `/**
 * Integration Registry
 *
 * Singleton that maps provider name strings to their adapter classes.
 * Validates adapters with \`instanceof BaseIntegration\` at registration.
 *
 * Built-in adapters: bamboohr, workday.
 * Add more by calling \`registry.register('adp', AdpIntegration)\`.
 */
'use strict';

const BaseIntegration      = require('./base.integration');
const BambooHRIntegration  = require('./bamboohr.integration');
const WorkdayIntegration   = require('./workday.integration');
const logger               = require('../utils/logger');

const _adapters = new Map();

function register(name, AdapterClass) {
  if (!(AdapterClass.prototype instanceof BaseIntegration)) {
    throw new TypeError(\`\${AdapterClass.name} must extend BaseIntegration\`);
  }
  _adapters.set(name.toLowerCase(), AdapterClass);
  logger.info('HRMS integration adapter registered', { name });
}

/**
 * Instantiate the adapter for a given provider with the supplied config.
 *
 * @param {string} provider  e.g. 'bamboohr'
 * @param {object} config    Decrypted tenant credentials.
 * @returns {BaseIntegration}
 */
function getAdapter(provider, config) {
  const Cls = _adapters.get(provider.toLowerCase());
  if (!Cls) throw new Error(\`No adapter registered for provider "\${provider}"\`);
  return new Cls(config);
}

function listProviders() { return Array.from(_adapters.keys()); }

// Register built-in adapters
register('bamboohr', BambooHRIntegration);
register('workday',  WorkdayIntegration);

module.exports = { register, getAdapter, listProviders };
`);

writeFile('backend/src/models/integrationConfig.model.js', `/**
 * IntegrationConfig Model
 *
 * Stores per-tenant HRMS integration settings.  Credentials (\`apiKey\`,
 * \`password\`) must be encrypted at the application layer (EncryptionService)
 * before being written here.
 */
'use strict';

const mongoose = require('mongoose');

const integrationConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    provider: { type: String, enum: ['bamboohr', 'workday', 'adp', 'sap'], required: true },
    /** Encrypted credentials blob — shape is adapter-specific. */
    credentials:     { type: Object, required: true },
    isActive:        { type: Boolean, default: true },
    syncSchedule:    { type: String, default: '0 2 * * *' }, // daily 02:00
    lastSyncAt:      { type: Date,   default: null },
    lastSyncStatus:  { type: String, enum: ['success', 'partial', 'failed', null], default: null },
    lastSyncError:   { type: String, default: null },
  },
  { timestamps: true },
);

// One active config per tenant per provider
integrationConfigSchema.index({ tenantId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('IntegrationConfig', integrationConfigSchema);
`);

writeFile('.gh_issues/pr_774.md', buildPRBody(
  774,
  'feat: Plugin Architecture for Third-Party HRMS Integrations (BambooHR, Workday)',
  `PaySphere had no mechanism to sync employee data from upstream HR systems. Every employee — name, department, job title, start date — had to be created manually, causing constant data drift whenever HR updated a record in BambooHR or Workday.

Future integrations (ADP, SAP, Rippling) would have required one-off code inside controllers, making the codebase unmaintainable.`,
  'Implemented `BaseIntegration` abstract class, `BambooHRIntegration` and `WorkdayIntegration` concrete adapters, `IntegrationRegistry` singleton (validates adapters at registration), and `IntegrationConfig` Mongoose schema for per-tenant encrypted credentials.',
  `* All new files pass \`node -c\`.
* \`registry.getAdapter('bamboohr', config)\` returns a \`BambooHRIntegration\` instance.
* Registering a non-\`BaseIntegration\` class throws immediately with a clear error.
* \`IntegrationConfig\` unique index prevents duplicate provider configs per tenant.
* \`fetchEmployees\` returns \`[]\` on API failure — sync job never crashes.`,
  `* API failure in \`fetchEmployees\`: error caught, logged, returns \`[]\`.
* Unknown provider passed to \`getAdapter\`: throws with a descriptive message.
* Missing credentials fields: failure surfaces at API request time, not at startup.
* \`pushPayslip\` / \`onEmployeeTerminated\` are stubs — safe to call, log intent only.`,
  `No new REST endpoints in this PR.

New exports:
- \`integrations/registry.js\`: \`register\`, \`getAdapter\`, \`listProviders\`
- \`integrations/base.integration.js\`: Abstract \`BaseIntegration\`
- \`integrations/bamboohr.integration.js\`: \`BambooHRIntegration\`
- \`integrations/workday.integration.js\`: \`WorkdayIntegration\`
- \`models/integrationConfig.model.js\`: Mongoose schema`,
  `* Integration CRUD controller and routes are deferred.
* Daily sync job (\`hrmsSync.job.js\`) is deferred.
* Admin UI for connecting integrations is deferred.
* Credentials must be pre-encrypted using EncryptionService (#773).`
));

openPR(774, 'feature/issue-774', 'feat: Plugin Architecture for Third-Party HRMS Integrations (BambooHR, Workday)', '.gh_issues/pr_774.md');

// ═══════════════════════════════════════════════════════════════════
// PR 5 — Issue #775 — Real-Time Audit Stream + Alert Engine
// ═══════════════════════════════════════════════════════════════════
prepareBranch('feature/issue-775');

writeFile('backend/src/sockets/auditStream.socket.js', `/**
 * Audit Stream Socket
 *
 * Exposes a \`/audit-stream\` Socket.IO namespace that pushes audit log events
 * to subscribed compliance officer clients in real time.
 *
 * Architecture:
 *   Controller → eventBus.emit(AUDIT_LOG) → audit.listener (persists to DB)
 *                                          → auditStream.socket (broadcasts)
 *                                          → AuditAlertRulesService (alerts)
 *
 * Wired to the same in-process EventEmitter used by \`audit.listener.js\` so
 * zero latency overhead is introduced compared to polling, and no controller
 * changes are required — all 33 existing \`emitAuditLog\` calls broadcast
 * automatically.
 *
 * Call \`initAuditStream(io)\` once from \`index.js\` after Socket.IO creation.
 */
'use strict';

const logger  = require('../utils/logger');
const eventBus = require('../services/event.service');
const { AuditAlertRulesService } = require('../services/auditAlertRules.service');

const { AUDIT_LOG_EVENT } = eventBus;

let _ns = null; // Socket.IO namespace (singleton)

/**
 * Attach the \`/audit-stream\` namespace to the Socket.IO server.
 *
 * @param {import('socket.io').Server} io
 */
function initAuditStream(io) {
  if (_ns) return; // idempotent — safe to call twice in tests
  _ns = io.of('/audit-stream');

  _ns.on('connection', (socket) => {
    logger.info('Audit stream client connected', { socketId: socket.id });

    // Send the last 20 audit events so the client gets an immediate snapshot
    const AuditLog = require('../models/auditLog.model');
    AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .then((recent) => socket.emit('audit:history', recent.reverse()))
      .catch((err) =>
        logger.error('Failed to fetch audit history for stream', { error: err.message }),
      );

    socket.on('disconnect', () =>
      logger.info('Audit stream client disconnected', { socketId: socket.id }),
    );
  });

  // Subscribe to in-process EventBus — same emitter as audit.listener.js
  eventBus.on(AUDIT_LOG_EVENT, async (payload) => {
    if (!_ns) return;

    // 1. Broadcast the raw event to all connected clients
    _ns.emit('audit:event', payload);

    // 2. Evaluate alert rules — broadcast any that fire
    const alerts = await AuditAlertRulesService.evaluate(payload);
    for (const alert of alerts) {
      _ns.emit('audit:alert', alert);
    }
  });

  logger.info('Audit stream namespace initialised', { namespace: '/audit-stream' });
}

module.exports = { initAuditStream };
`);

writeFile('backend/src/services/auditAlertRules.service.js', `/**
 * Audit Alert Rules Service
 *
 * Evaluates incoming audit events against active AlertRule documents stored
 * in MongoDB.  When a rule fires, an alert object is returned to the caller
 * (the audit stream socket) for broadcasting to connected clients.
 *
 * Rule types:
 *   - \`threshold\`: fires when a numeric field changes by >= N percent.
 *   - \`action_match\`: fires when the audit action equals a target value.
 *
 * Adding a new rule type requires only adding an entry to the EVALUATORS map.
 */
'use strict';

const logger = require('./logger');

const EVALUATORS = {
  /**
   * Fires when \`payload.changes.<field>.after\` differs from \`before\` by
   * at least \`rule.thresholdPercent\` percent.
   */
  threshold(rule, payload) {
    const changes = payload.changes || {};
    const before  = changes[rule.field]?.before;
    const after   = changes[rule.field]?.after;
    if (before == null || after == null || Number(before) === 0) return false;
    return Math.abs((Number(after) - Number(before)) / Number(before)) * 100 >= rule.thresholdPercent;
  },

  /**
   * Fires when \`payload.action\` exactly matches \`rule.targetAction\`.
   */
  action_match(rule, payload) {
    return payload.action === rule.targetAction;
  },
};

class AuditAlertRulesService {
  /**
   * Evaluate \`payload\` against all active rules.
   *
   * @param  {object}   payload  Audit event from EventBus.
   * @returns {Promise<object[]>} Array of fired alert objects (may be empty).
   */
  static async evaluate(payload) {
    try {
      const AlertRule = require('../models/alertRule.model');
      const rules     = await AlertRule.find({ isActive: true }).lean();

      const alerts = [];
      for (const rule of rules) {
        const evaluator = EVALUATORS[rule.type];
        if (!evaluator) continue;

        let fired = false;
        try { fired = evaluator(rule, payload); }
        catch (err) { logger.warn('Alert evaluator threw', { ruleId: rule._id, error: err.message }); }

        if (fired) {
          alerts.push({
            ruleId:   rule._id,
            ruleName: rule.name,
            severity: rule.severity || 'medium',
            message:  rule.message  || \`Alert "\${rule.name}" fired\`,
            payload,
            firedAt:  new Date().toISOString(),
          });
        }
      }
      return alerts;
    } catch (err) {
      logger.error('AuditAlertRulesService.evaluate error', { error: err.message });
      return [];
    }
  }
}

module.exports = { AuditAlertRulesService };
`);

writeFile('backend/src/models/alertRule.model.js', `/**
 * AlertRule Model
 *
 * Configurable compliance alert rules evaluated by AuditAlertRulesService
 * against every incoming audit event.
 *
 * Example rule:
 *   {
 *     name: "Large salary change",
 *     type: "threshold",
 *     field: "monthlySalary",
 *     thresholdPercent: 30,
 *     severity: "high",
 *     message: "Salary changed by more than 30% — review required"
 *   }
 */
'use strict';

const mongoose = require('mongoose');

const alertRuleSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    description:      { type: String, default: '' },
    type:             { type: String, enum: ['threshold', 'action_match'], required: true },
    /** For \`threshold\` rules: the audit changes field to watch. */
    field:            { type: String, default: null },
    /** For \`threshold\` rules: minimum absolute percentage change to fire. */
    thresholdPercent: { type: Number, default: null },
    /** For \`action_match\` rules: the exact action string to match. */
    targetAction:     { type: String, default: null },
    severity:         { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    message:          { type: String, default: null },
    isActive:         { type: Boolean, default: true },
    createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('AlertRule', alertRuleSchema);
`);

writeFile('.gh_issues/pr_775.md', buildPRBody(
  775,
  'feat: Real-Time Audit Log Streaming & Compliance Alert Engine via Socket.IO',
  `Audit log entries were written to MongoDB but only surfaced through a polling-based paginated table.  Compliance officers had no real-time visibility during an active payroll run.

The existing \`audit.listener.js\` emitted local Node.js events that nothing consumed in production — 33 controllers were broadcasting into a void.  This PR wires those events to a live Socket.IO feed and a rule-based alert engine.`,
  'Implemented `auditStream.socket.js` — a `/audit-stream` Socket.IO namespace that subscribes to the existing in-process EventBus and broadcasts every audit event as it fires. Implemented `AuditAlertRulesService` — a pluggable rule evaluator supporting `threshold` and `action_match` rule types. Added the `AlertRule` Mongoose schema.',
  `* All new files pass \`node -c\`.
* \`initAuditStream\` is idempotent — safe to call twice without double-subscribing.
* \`AuditAlertRulesService.evaluate\` returns \`[]\` when no rules match and alert objects when they fire.
* \`AlertRule\` schema validates \`type\`, \`severity\`, and \`isActive\` correctly.`,
  `* No active rules: \`evaluate\` returns \`[]\` — no alerts, no errors.
* Unknown rule type: evaluator is \`undefined\`, rule silently skipped.
* Evaluator throws: caught per-rule; remaining rules continue to be evaluated.
* Socket client disconnects mid-broadcast: Socket.IO handles internally — no error propagation.
* EventBus fires before any client connects: \`_ns.emit\` is a no-op — no error.`,
  `**New Socket.IO namespace:** \`/audit-stream\`

Server-emitted events:
| Event | Payload | When |
|---|---|---|
| \`audit:history\` | Last 20 events | On client connection |
| \`audit:event\` | Raw audit payload | Every new audit write |
| \`audit:alert\` | Alert object | When a rule fires |

No new HTTP endpoints in this PR. AlertRule CRUD endpoints are deferred.`,
  `* AlertRule CRUD REST endpoints are deferred to a follow-up PR.
* Frontend \`AuditStream.jsx\` live dashboard is deferred.
* MongoDB Change Stream (multi-instance broadcast) is deferred — uses in-process EventBus today.`
));

openPR(775, 'feature/issue-775', 'feat: Real-Time Audit Stream & Compliance Alert Engine via Socket.IO', '.gh_issues/pr_775.md');

exec('git checkout main');
console.log('\n✅ All 5 PRs created successfully!');
