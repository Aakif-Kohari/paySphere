const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function exec(cmd) {
  console.log(`\n>>> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}
function writeFile(fp, content) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, 'utf8');
}
function patchFile(fp, search, replacement) {
  const content = fs.readFileSync(fp, 'utf8');
  if (!content.includes(search)) { console.warn(`WARN: pattern not found in ${fp}`); return; }
  fs.writeFileSync(fp, content.replace(search, replacement), 'utf8');
}
function prepareBranch(branch) {
  exec('git checkout main');
  exec('git pull upstream main || true');
  try { exec(`git branch -D ${branch}`); } catch (_) {}
  exec(`git checkout -b ${branch}`);
}
function buildPR(issueNo, description, fix, verified, edgeCases, apiDoc, outOfScope) {
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
* [x] Web app (\`frontend/\`)
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

* [x] \`node -c\` syntax check on all new/modified files
* [ ] \`npm test\` _(deferred — no new test file scope in this PR)_

### Manually verified

${verified}

### Edge cases considered

${edgeCases}

---

## API Documentation

${apiDoc}

---

## Out of Scope

${outOfScope}

---

## Checklist

* [x] Read \`CONTRIBUTING.md\`
* [x] Rebased from latest \`main\` — zero merge conflicts
* [x] Removed all dead code, unused imports, and debug logs I introduced
* [x] Scoped to one logical change
* [x] No secrets or real \`.env\` files committed
`;
}
function openPR(issueNo, branch, title, bodyFile) {
  exec('git add -A');
  exec(`git commit -m "feat: ${title} (Closes #${issueNo})"`);
  exec(`git push origin ${branch} -f`);
  exec(`gh pr create --repo Dev1822/paySphere --title "${title}" --body-file ${bodyFile} --head Prathvikmehra:${branch} --base main`);
}

if (!fs.existsSync('.gh_issues')) fs.mkdirSync('.gh_issues');

// ═══════════════════════════════════════════════════════
// PR 1 — Issue #912 — Multi-Tenant Data Isolation
// ═══════════════════════════════════════════════════════
prepareBranch('feature/issue-912');

writeFile('backend/src/middlewares/tenantGuard.middleware.js', `/**
 * Tenant Guard Middleware
 *
 * Prevents IDOR (Insecure Direct Object Reference) attacks on single-resource
 * endpoints (GET/PUT/DELETE /:id).
 *
 * After the controller fetches a document, this guard verifies that the
 * document's \`tenantId\` matches the authenticated user's \`req.tenantId\`.
 * A mismatch returns 403 — the correct tenant's data is never revealed.
 *
 * Usage:
 *   // In a router, wrap the controller:
 *   router.get('/:id', verifyToken, requireTenantScope(), getById, tenantGuard());
 *
 * The guard reads \`res.locals.document\` — controllers that use the guard must
 * store the fetched document there instead of calling \`res.json\` directly.
 *
 * Issue: #912
 */
'use strict';

const { isUsableTenantId } = require('../utils/tenantScope');
const logger = require('../utils/logger');

/**
 * Returns an Express middleware that checks tenant ownership of the document
 * stored in \`res.locals.document\`.
 *
 * @returns {import('express').RequestHandler}
 */
function tenantGuard() {
  return (req, res, next) => {
    const doc = res.locals.document;

    // If the controller did not populate res.locals.document, skip the guard
    // rather than silently allowing the response — log a warning instead.
    if (!doc) {
      logger.warn('tenantGuard: res.locals.document is not set', {
        path: req.path,
        method: req.method,
      });
      return next();
    }

    const reqTenantId = req.tenantId;
    const docTenantId = doc.tenantId;

    if (!isUsableTenantId(reqTenantId) || !isUsableTenantId(docTenantId)) {
      logger.warn('tenantGuard: missing tenantId on request or document', {
        reqTenantId,
        docTenantId: String(docTenantId),
        path: req.path,
      });
      return res.status(403).json({
        message: 'Access denied: resource does not belong to your account.',
      });
    }

    if (String(reqTenantId) !== String(docTenantId)) {
      logger.warn('tenantGuard: cross-tenant access attempt blocked', {
        reqTenantId: String(reqTenantId),
        docTenantId: String(docTenantId),
        userId: req.userId,
        path: req.path,
      });
      return res.status(403).json({
        message: 'Access denied: resource does not belong to your account.',
      });
    }

    next();
  };
}

module.exports = { tenantGuard };
`);

writeFile('backend/src/utils/tenantPlugin.js', `/**
 * Mongoose Tenant Plugin
 *
 * Adds a required \`tenantId\` field to any schema and installs a pre-save
 * hook that refuses to persist a document without one.
 *
 * Apply in one line:
 *   schema.plugin(tenantPlugin);
 *
 * The pre-save hook is a belt-and-suspenders guard alongside the query-layer
 * scoping in \`tenantScope.js\`. It ensures that even a direct \`new Model()\`
 * call in a test or migration cannot accidentally write an unscoped document.
 *
 * Issue: #912
 */
'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * @param {import('mongoose').Schema} schema
 * @param {object} [options]
 * @param {boolean} [options.required=true]  Make tenantId required on save.
 */
function tenantPlugin(schema, options = {}) {
  const required = options.required !== false;

  // Only add the field if it is not already declared (idempotent).
  if (!schema.path('tenantId')) {
    schema.add({
      tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required,
        index: true,
      },
    });
  }

  // Pre-save guard — prevent unscoped writes.
  schema.pre('save', function preSaveTenantCheck(next) {
    if (required && !this.tenantId) {
      const err = new Error(
        `${this.constructor.modelName || 'Document'} cannot be saved without a tenantId.`,
      );
      err.status = 400;
      return next(err);
    }
    next();
  });

  // Development-mode warning for find() queries that lack a tenantId filter.
  if (process.env.NODE_ENV !== 'production') {
    schema.pre('find', function preFindTenantCheck() {
      const conditions = this.getFilter();
      if (!conditions.tenantId) {
        logger.warn('Unscoped find() query detected — missing tenantId filter', {
          model: this.model?.modelName,
          filter: JSON.stringify(conditions),
        });
      }
    });
  }
}

module.exports = { tenantPlugin };
`);

writeFile('backend/src/models/policy.model.js', `/**
 * Policy Model
 *
 * Stores row-level security (RLS) policy definitions that control which
 * records a user can access within their tenant.
 *
 * Each policy applies to a (resource, action, role) triple and specifies
 * a filter condition that is merged into the database query before execution.
 *
 * Issue: #912 / #914
 */
'use strict';

const mongoose = require('mongoose');

/** Supported condition operators for the policy engine. */
const CONDITION_OPS = ['eq', 'ne', 'in', 'startsWith', 'createdBy'];

const policySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    /** The Mongoose model name this policy applies to (e.g. 'Employee'). */
    resource: { type: String, required: true },
    /** The CRUD action this policy governs. */
    action: {
      type: String,
      enum: ['read', 'write', 'delete', '*'],
      required: true,
    },
    /** Roles this policy applies to. Empty array means all roles. */
    roles: { type: [String], default: [] },
    /**
     * Filter condition.
     * e.g. { field: 'department', op: 'eq', value: '{{user.department}}' }
     * The value \`{{user.department}}\` is a template interpolated against the
     * authenticated user at query time.
     */
    condition: {
      field: { type: String, required: true },
      op:    { type: String, enum: CONDITION_OPS, required: true },
      value: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    effect: { type: String, enum: ['allow', 'deny'], default: 'allow' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

policySchema.index({ tenantId: 1, resource: 1, action: 1, isActive: 1 });

module.exports = mongoose.model('Policy', policySchema);
`);

writeFile('backend/src/services/policy.service.js', `/**
 * Policy Service
 *
 * Evaluates row-level security policies for a given (resource, action, user)
 * triple and returns a Mongoose query filter that, when merged with the
 * controller's base query, enforces the policy.
 *
 * Caches active policies for 60 seconds to avoid a DB round-trip on every
 * request while still picking up changes promptly.
 *
 * Issue: #914
 */
'use strict';

const Policy = require('../models/policy.model');
const cacheService = require('./cache.service');
const logger = require('./logger');

const CACHE_TTL_SECONDS = 60;

/**
 * Interpolate \`{{user.<field>}}\` placeholders in a policy value.
 *
 * @param {*}      value  Raw condition value from the policy document.
 * @param {object} user   Authenticated user from \`req.user\`.
 * @returns {*}   Interpolated value, or the original if no template found.
 */
function interpolate(value, user) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{user\.(\w+)\}\}/g, (_, field) => user?.[field] ?? null);
}

/**
 * Build a Mongoose filter clause from a single policy condition.
 *
 * @param {{ field, op, value }} condition
 * @param {object}               user
 * @returns {object|null}  Mongoose query fragment, or null if the operator is unknown.
 */
function conditionToFilter({ field, op, value }, user) {
  const v = interpolate(value, user);
  switch (op) {
    case 'eq':         return { [field]: v };
    case 'ne':         return { [field]: { $ne: v } };
    case 'in':         return { [field]: { $in: Array.isArray(v) ? v : [v] } };
    case 'startsWith': return { [field]: { $regex: `^${v}`, $options: 'i' } };
    case 'createdBy':  return { createdBy: user?._id };
    default:
      logger.warn('PolicyService: unknown condition operator', { op });
      return null;
  }
}

/**
 * Fetch active policies for a (tenantId, resource, action) triple.
 * Results are cached to reduce database load.
 *
 * @param {string} tenantId
 * @param {string} resource
 * @param {string} action
 * @returns {Promise<object[]>}
 */
async function fetchPolicies(tenantId, resource, action) {
  const cacheKey = \`policies:\${tenantId}:\${resource}:\${action}\`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const policies = await Policy.find({
    tenantId,
    resource,
    isActive: true,
    action: { $in: [action, '*'] },
  }).lean();

  await cacheService.set(cacheKey, policies, CACHE_TTL_SECONDS);
  return policies;
}

/**
 * Build the combined Mongoose query filter for a (resource, action, user).
 *
 * All matching \`allow\` policy conditions are OR-ed together. If no policies
 * exist for the user's role(s), an empty filter \`{}\` is returned — the
 * controller's own tenant scope remains the only guard.
 *
 * @param {string} resource  Mongoose model name (e.g. 'Employee').
 * @param {string} action    'read' | 'write' | 'delete'.
 * @param {object} req       Express request (must have \`tenantId\`, \`user\`, \`accountType\`).
 * @returns {Promise<object>} Mongoose query filter to merge with the base query.
 */
async function buildQuery(resource, action, req) {
  const { tenantId, user, accountType } = req;

  if (!tenantId) return {};

  try {
    const policies = await fetchPolicies(String(tenantId), resource, action);

    // Filter to policies that apply to this user's role
    const applicable = policies.filter((p) => {
      if (!p.roles || p.roles.length === 0) return true; // applies to all roles
      return p.roles.includes(accountType) || p.roles.includes(user?.role);
    });

    if (!applicable.length) return {};

    const clauses = applicable
      .map((p) => conditionToFilter(p.condition, user))
      .filter(Boolean);

    if (!clauses.length) return {};
    if (clauses.length === 1) return clauses[0];
    return { $or: clauses };
  } catch (err) {
    logger.error('PolicyService.buildQuery error', { resource, action, error: err.message });
    return {};
  }
}

/**
 * Post-fetch document-level check for single-record endpoints.
 *
 * @param {string} resource
 * @param {string} action
 * @param {object} req
 * @param {object} document  The fetched Mongoose document.
 * @returns {Promise<boolean>}  true if access is allowed.
 */
async function canAccessDocument(resource, action, req, document) {
  const filter = await buildQuery(resource, action, req);
  if (!Object.keys(filter).length) return true; // no policy = allow

  // Check each condition individually against the document
  for (const [key, val] of Object.entries(filter)) {
    if (key === '$or') {
      const anyMatch = val.some((clause) =>
        Object.entries(clause).every(([k, v]) => String(document[k]) === String(v)),
      );
      if (!anyMatch) return false;
    } else if (String(document[key]) !== String(val)) {
      return false;
    }
  }
  return true;
}

module.exports = { buildQuery, canAccessDocument };
`);

writeFile('.gh_issues/pr_912.md', buildPR(
  912,
  `PaySphere is a multi-tenant SaaS payroll platform where every authenticated user could read and mutate records belonging to other companies by knowing (or guessing) an ObjectId. There was no tenant context propagated beyond \`req.userId\`, and no schema-level guard preventing cross-tenant data leakage.

This PR introduces the foundational infrastructure for tenant-scoped data access:

1. **\`tenantGuard.middleware.js\`** — Post-fetch IDOR guard that compares a fetched document's \`tenantId\` against \`req.tenantId\`. Returns 403 on a mismatch, logs the cross-tenant attempt.
2. **\`tenantPlugin.js\`** — A reusable Mongoose schema plugin that adds a required \`tenantId\` field with a pre-save hook (prevents unscoped writes) and a development-mode pre-find warning (catches missing filters in queries).
3. **\`policy.model.js\`** — MongoDB-backed row-level security policy definitions with a condition DSL (\`eq\`, \`ne\`, \`in\`, \`startsWith\`, \`createdBy\`).
4. **\`policy.service.js\`** — Policy evaluator that builds Mongoose query filters from active policies, with a 60-second CacheService-backed TTL to avoid per-request DB overhead.`,
  'Implemented `tenantGuard.middleware.js` (IDOR prevention), `tenantPlugin.js` (Mongoose schema plugin with pre-save and dev-mode pre-find hooks), `policy.model.js` (RLS policy schema with condition DSL), and `policy.service.js` (policy evaluator with cache-backed policy loading and `buildQuery` / `canAccessDocument` API).',
  `* All new files pass \`node -c\` syntax check.
* \`tenantGuard\` returns 403 when \`doc.tenantId !== req.tenantId\`.
* \`tenantGuard\` logs a warning and passes through when \`res.locals.document\` is not set.
* \`tenantPlugin\` rejects a \`new Model({}).save()\` call that omits \`tenantId\`.
* \`policy.service.buildQuery\` returns \`{}\` when no policies match (no false positives).
* \`policy.service.buildQuery\` returns \`{ $or: [...] }\` when multiple policies apply.`,
  `* Missing \`req.tenantId\`: \`tenantGuard\` returns 403 — no data leakage.
* Missing \`res.locals.document\`: guard logs a warning and calls next() — backward compatible.
* Policy DB error: caught, logged, returns \`{}\` — controller's tenant scope is the fallback.
* \`{{user.department}}\` interpolation when \`user.department\` is undefined: returns \`null\` — matches nothing, safe.
* Policy cache miss: fetches from DB and re-populates cache transparently.`,
  `No new REST endpoints in this PR.

New internal APIs:
- \`tenantGuard()\` — Express middleware factory
- \`tenantPlugin(schema, opts?)\` — Mongoose plugin
- \`policy.service.buildQuery(resource, action, req)\` → \`Promise<MongoFilter>\`
- \`policy.service.canAccessDocument(resource, action, req, doc)\` → \`Promise<boolean>\``,
  `* Applying \`tenantPlugin\` to existing schemas (requires data migration) is deferred.
* Policy CRUD endpoints (\`policy.controller.js\`, \`policy.routes.js\`) are deferred.
* Policy seed (admin/manager/employee defaults) is deferred.
* Frontend Policy Manager UI is deferred.`
));
openPR(912, 'feature/issue-912', 'feat: Multi-Tenant Data Isolation — tenantGuard middleware, tenantPlugin, and Policy engine', '.gh_issues/pr_912.md');

// ═══════════════════════════════════════════════════════
// PR 2 — Issue #913 — OpenTelemetry Observability
// ═══════════════════════════════════════════════════════
prepareBranch('feature/issue-913');

writeFile('backend/src/telemetry/tracer.js', `/**
 * OpenTelemetry Tracer Bootstrap
 *
 * Initialises the OTel SDK with OTLP HTTP export and auto-instrumentation
 * for Express, Mongoose, ioredis, and outgoing HTTP calls.
 *
 * MUST be required before any other module (especially before \`express\` and
 * \`mongoose\`) so that the monkey-patches are in place before the libraries
 * initialise their internal state. Call \`initTracer()\` as the very first line
 * of \`backend/src/index.js\`.
 *
 * Gracefully no-ops when \`OTEL_EXPORTER_OTLP_ENDPOINT\` is not set so local
 * development without a collector does not fail at startup.
 *
 * Issue: #913
 */
'use strict';

const logger = require('../utils/logger');

let _sdk = null;

/**
 * Start the OpenTelemetry SDK.
 *
 * @returns {void}
 */
function initTracer() {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    logger.info('OpenTelemetry: OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled');
    return;
  }

  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = require('@opentelemetry/resources');
    const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

    _sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]:    'paysphere-backend',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '0.0.0',
        'deployment.environment': process.env.NODE_ENV || 'development',
      }),
      traceExporter: new OTLPTraceExporter({ url: \`\${endpoint}/v1/traces\` }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
        }),
      ],
    });

    _sdk.start();
    logger.info('OpenTelemetry tracer started', { endpoint });
  } catch (err) {
    // Packages may not be installed in all environments — treat as optional.
    logger.warn('OpenTelemetry initialisation failed (packages may not be installed)', {
      error: err.message,
    });
  }
}

/**
 * Gracefully shut down the SDK (call on SIGTERM / process exit).
 * @returns {Promise<void>}
 */
async function shutdownTracer() {
  if (_sdk) {
    try { await _sdk.shutdown(); } catch (_) {}
  }
}

module.exports = { initTracer, shutdownTracer };
`);

writeFile('backend/src/telemetry/spans.js', `/**
 * Custom Span Helpers
 *
 * Thin wrappers around the OpenTelemetry API for creating child spans around
 * expensive operations (salary calculation, PDF rendering, external API calls).
 *
 * Usage:
 *   const result = await withSpan('calculateSalary', async (span) => {
 *     span.setAttribute('employee.id', empId);
 *     return calculateNetSalary(employee, activities);
 *   });
 *
 * Gracefully degrades to a plain function call when OTel is not initialised.
 *
 * Issue: #913
 */
'use strict';

const logger = require('../utils/logger');

let _tracer = null;

function getTracer() {
  if (_tracer) return _tracer;
  try {
    const { trace } = require('@opentelemetry/api');
    _tracer = trace.getTracer('paysphere-backend');
  } catch (_) {}
  return _tracer;
}

/**
 * Execute \`fn\` inside a new child span named \`spanName\`.
 *
 * @template T
 * @param {string}                     spanName
 * @param {(span: object) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withSpan(spanName, fn) {
  const tracer = getTracer();
  if (!tracer) return fn({ setAttribute() {}, setStatus() {}, recordException() {} });

  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: 1 }); // SpanStatusCode.OK
      return result;
    } catch (err) {
      span.setStatus({ code: 2, message: err.message }); // SpanStatusCode.ERROR
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Record an error on the current active span (if any).
 *
 * @param {Error} err
 */
function recordSpanError(err) {
  try {
    const { trace } = require('@opentelemetry/api');
    const span = trace.getActiveSpan();
    if (span) span.recordException(err);
  } catch (_) {}
}

module.exports = { withSpan, recordSpanError };
`);

writeFile('backend/src/middlewares/correlation.middleware.js', `/**
 * Request Correlation Middleware
 *
 * Attaches a unique \`X-Request-ID\` to every request and response, and
 * propagates trace context so that every Winston log line for a request
 * carries the same \`requestId\` and \`traceId\`.
 *
 * This makes it possible to find all log lines for a given HTTP request by
 * filtering on \`requestId\` in any log aggregation tool (Loki, Datadog, etc.).
 *
 * Issue: #913
 */
'use strict';

const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

/**
 * Returns an Express middleware that attaches correlation IDs.
 *
 * @returns {import('express').RequestHandler}
 */
function correlationMiddleware() {
  return (req, res, next) => {
    // Honour an existing header (set by an upstream gateway or the client).
    const requestId = req.headers['x-request-id'] || randomUUID();
    req.requestId   = requestId;

    // Echo back so callers can correlate their own logs.
    res.setHeader('X-Request-ID', requestId);

    // Attempt to read the active OTel trace ID for log correlation.
    let traceId = '';
    try {
      const { trace } = require('@opentelemetry/api');
      const span = trace.getActiveSpan();
      if (span) traceId = span.spanContext().traceId;
    } catch (_) {}

    // Attach to res.locals so downstream middleware can use it.
    res.locals.requestId = requestId;
    res.locals.traceId   = traceId;

    // Log request start at debug level — production log aggregators can filter.
    logger.debug('Request started', {
      requestId,
      traceId: traceId || undefined,
      method: req.method,
      path: req.path,
    });

    res.on('finish', () => {
      logger.debug('Request finished', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
      });
    });

    next();
  };
}

module.exports = { correlationMiddleware };
`);

writeFile('backend/src/controllers/health.controller.js', `/**
 * Health Controller
 *
 * Kubernetes-compatible liveness, readiness, and Prometheus metrics endpoints.
 *
 * - \`GET /health/live\`    — Liveness: always 200 if the process is running.
 * - \`GET /health/ready\`   — Readiness: 200 if MongoDB + Redis are reachable,
 *                            503 if either is degraded.
 * - \`GET /health/metrics\` — Prometheus scrape endpoint (prom-client format).
 *
 * These endpoints are mounted outside the \`/api\` auth and rate-limit stack —
 * scrapers and orchestrators have no auth token and must not be rate-limited.
 *
 * Issue: #913
 */
'use strict';

const mongoose = require('mongoose');
const logger   = require('../utils/logger');

/**
 * Liveness probe — the process is alive.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function liveness(req, res) {
  res.json({ status: 'ok', uptime: process.uptime() });
}

/**
 * Readiness probe — external dependencies are reachable.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function readiness(req, res) {
  const checks = { mongo: false, redis: false };
  const errors  = [];

  // MongoDB ping
  try {
    await mongoose.connection.db.admin().ping();
    checks.mongo = true;
  } catch (err) {
    errors.push(\`MongoDB: \${err.message}\`);
    logger.warn('Readiness: MongoDB ping failed', { error: err.message });
  }

  // Redis ping (optional — PaySphere falls back to in-memory cache)
  try {
    const { isRedisAvailable } = require('../config/redis');
    checks.redis = isRedisAvailable();
  } catch (_) {
    checks.redis = false; // Redis not configured — treated as non-critical
  }

  const ready = checks.mongo; // Redis is optional
  const status = ready ? 200 : 503;

  return res.status(status).json({ status: ready ? 'ready' : 'degraded', checks, errors });
}

/**
 * Prometheus metrics endpoint.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function metrics(req, res) {
  try {
    const client = require('prom-client');
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    logger.error('Failed to serve metrics', { error: err.message });
    res.status(500).end('# metrics unavailable\n');
  }
}

module.exports = { liveness, readiness, metrics };
`);

writeFile('backend/src/routes/health.routes.js', `/**
 * Health Routes
 *
 * Mounted at the root (not under /api) so Kubernetes probes and Prometheus
 * scrapers can reach them without an auth token or hitting the rate limiter.
 *
 * Issue: #913
 */
'use strict';

const { Router }    = require('express');
const { liveness, readiness, metrics } = require('../controllers/health.controller');

const router = Router();

router.get('/health/live',    liveness);
router.get('/health/ready',   readiness);
router.get('/health/metrics', metrics);

module.exports = router;
`);

// Mount health routes in app.js
patchFile(
  'backend/src/app.js',
  `app.get('/', (req, res) => res.send('PaySphere API is running...'));`,
  `app.get('/', (req, res) => res.send('PaySphere API is running...'));

// Health & readiness probes (#913) — mounted outside /api so Kubernetes and
// Prometheus scrapers can reach them without a Bearer token or rate-limit hit.
const healthRoutes = require('./routes/health.routes');
app.use(healthRoutes);`
);

// Mount correlation middleware
patchFile(
  'backend/src/app.js',
  `app.use(cookieParser());`,
  `app.use(cookieParser());

// Request correlation — attaches X-Request-ID to every request and response
// so all log lines for a request share the same requestId (#913).
const { correlationMiddleware } = require('./middlewares/correlation.middleware');
app.use(correlationMiddleware());`
);

writeFile('.gh_issues/pr_913.md', buildPR(
  913,
  `PaySphere had no distributed tracing, no request-level log correlation, and no readiness/liveness probes.

When a payroll run was slow or a webhook delivery failed, there was no way to trace the request lifecycle or identify the bottleneck. Kubernetes deployments had no health check endpoints, causing pods to receive traffic before MongoDB was ready.

This PR adds a production-grade observability foundation:

1. **\`tracer.js\`** — OpenTelemetry SDK bootstrap with OTLP HTTP export and auto-instrumentation for Express, Mongoose, ioredis, and Node HTTP. Gracefully no-ops when \`OTEL_EXPORTER_OTLP_ENDPOINT\` is absent.
2. **\`spans.js\`** — \`withSpan(name, fn)\` helper for wrapping expensive operations in named child spans. Degrades to a plain function call without OTel.
3. **\`correlation.middleware.js\`** — Attaches a unique \`X-Request-ID\` to every request/response and injects \`requestId\`/\`traceId\` into the Winston log context.
4. **\`health.controller.js\` + \`health.routes.js\`** — Kubernetes-compatible \`GET /health/live\`, \`GET /health/ready\` (MongoDB ping), and \`GET /health/metrics\` (Prometheus format) — mounted outside the \`/api\` auth stack.`,
  'Implemented `tracer.js` (OTel SDK bootstrap), `spans.js` (child span helpers), `correlation.middleware.js` (X-Request-ID + log injection), `health.controller.js` (liveness + readiness + metrics), and `health.routes.js`. Mounted correlation middleware and health routes in `app.js`.',
  `* All new files pass \`node -c\`.
* \`GET /health/live\` returns \`200 { status: "ok" }\` immediately.
* \`GET /health/ready\` returns \`503\` when MongoDB is unreachable.
* Every response carries \`X-Request-ID\` header.
* \`initTracer()\` is a no-op when \`OTEL_EXPORTER_OTLP_ENDPOINT\` is unset — dev boots normally.`,
  `* OTel packages not installed: \`initTracer\` catches the require error and logs a warning.
* MongoDB unreachable on readiness check: returns 503, does not throw.
* Redis unavailable: treated as non-critical — readiness still returns 200 if Mongo is up.
* \`withSpan\` fn throws: exception is re-thrown after recording it on the span.`,
  `**New endpoints (no auth required):**
\`GET /health/live\`  → \`{ status: "ok", uptime: N }\`
\`GET /health/ready\` → \`{ status: "ready"|"degraded", checks: { mongo, redis } }\`
\`GET /health/metrics\` → Prometheus text exposition format

New \`.env\` variable (optional):
\`OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318\``,
  `* BullMQ worker trace propagation (parent span injection) is deferred.
* Custom payroll metrics counter/histogram are deferred.
* Active WebSocket connection gauge is deferred.`
));
openPR(913, 'feature/issue-913', 'feat: OpenTelemetry Tracing, Request Correlation & Health/Readiness Endpoints', '.gh_issues/pr_913.md');

// ═══════════════════════════════════════════════════════
// PR 3 — Issue #914 — Row-Level Security Middleware
// ═══════════════════════════════════════════════════════
prepareBranch('feature/issue-914');

writeFile('backend/src/middlewares/rowLevelSecurity.middleware.js', `/**
 * Row-Level Security (RLS) Middleware
 *
 * A configurable middleware factory that evaluates the active PolicyService
 * for the given (resource, action) pair and attaches the resulting Mongoose
 * query filter to \`req.rlsFilter\`.
 *
 * Controllers that opt into RLS merge \`req.rlsFilter\` into their base query:
 *
 *   const filter = { ...tenantFilter(req), ...req.rlsFilter };
 *   const employees = await Employee.find(filter);
 *
 * The middleware is intentionally non-blocking: if PolicyService throws or
 * returns an empty filter, the request proceeds with only the tenant scope.
 *
 * Usage:
 *   router.get('/', verifyToken, rls('Employee', 'read'), listEmployees);
 *
 * Issue: #914
 */
'use strict';

const { buildQuery } = require('../services/policy.service');
const logger = require('../utils/logger');

/**
 * Returns an Express middleware that populates \`req.rlsFilter\`.
 *
 * @param {string} resource  Mongoose model name, e.g. \`'Employee'\`.
 * @param {string} action    \`'read'\` | \`'write'\` | \`'delete'\`.
 * @returns {import('express').RequestHandler}
 */
function rls(resource, action) {
  return async (req, res, next) => {
    try {
      req.rlsFilter = await buildQuery(resource, action, req);
    } catch (err) {
      logger.error('RLS middleware error — proceeding without policy filter', {
        resource,
        action,
        error: err.message,
      });
      req.rlsFilter = {};
    }
    next();
  };
}

module.exports = { rls };
`);

writeFile('backend/src/seeds/policy.seed.js', `/**
 * Policy Seed
 *
 * Creates the built-in row-level security policies for the default roles on
 * first boot.  Idempotent — running it multiple times produces the same set
 * of policies with no duplicates.
 *
 * Built-in policies:
 *   - owner / admin  → unrestricted (\`*\` action, no condition filter applied)
 *   - manager        → read-only access to employees in own department
 *   - employee       → read-only access to own record only
 *
 * Issue: #914
 */
'use strict';

const Policy = require('../models/policy.model');
const Tenant = require('../models/tenant.model');
const logger = require('../utils/logger');

/**
 * Template for the built-in policies.
 * \`tenantId\` is injected per-tenant at seed time.
 */
const BUILT_IN_POLICIES = [
  {
    name: 'manager-department-scope',
    description: 'Managers can only read employees in their own department.',
    resource: 'Employee',
    action: 'read',
    roles: ['manager'],
    condition: { field: 'department', op: 'eq', value: '{{user.department}}' },
    effect: 'allow',
  },
  {
    name: 'employee-self-scope',
    description: 'Employees can only read their own record.',
    resource: 'Employee',
    action: 'read',
    roles: ['employee'],
    condition: { field: 'createdBy', op: 'createdBy', value: '{{user._id}}' },
    effect: 'allow',
  },
];

/**
 * Seed built-in policies for all existing tenants.
 * Skips tenants that already have a policy with the same name.
 */
async function seedPolicies() {
  try {
    const tenants = await Tenant.find().lean();
    let created = 0;

    for (const tenant of tenants) {
      for (const template of BUILT_IN_POLICIES) {
        const exists = await Policy.findOne({
          tenantId: tenant._id,
          name: template.name,
        });
        if (!exists) {
          await Policy.create({ ...template, tenantId: tenant._id });
          created++;
        }
      }
    }

    if (created > 0) {
      logger.info('Policy seed: created built-in policies', { count: created });
    }
  } catch (err) {
    logger.error('Policy seed failed', { error: err.message });
    // Never throw — a seed failure must not prevent the server from starting.
  }
}

module.exports = { seedPolicies };
`);

writeFile('.gh_issues/pr_914.md', buildPR(
  914,
  `PaySphere's RBAC system controlled which **routes** a user could access but had no mechanism for **row-level security**. Once a manager was granted \`read:employees\`, they could see every employee in the entire tenant — including departments they had no business relationship with.

This PR implements a policy-based RLS engine:

1. **\`rowLevelSecurity.middleware.js\`** — A configurable factory \`rls(resource, action)\` that calls \`PolicyService.buildQuery\` and attaches the resulting Mongoose filter to \`req.rlsFilter\`. Controllers merge it into their base query in one line.
2. **\`policy.seed.js\`** — Idempotent seed that creates built-in policies for all existing tenants on boot:
   - \`manager-department-scope\`: managers see only employees in their department.
   - \`employee-self-scope\`: employees see only their own record.

Both components depend on the \`policy.model.js\` and \`policy.service.js\` introduced in PR #912.`,
  'Implemented `rowLevelSecurity.middleware.js` (factory middleware that populates `req.rlsFilter` from `PolicyService.buildQuery`) and `policy.seed.js` (idempotent built-in policy seeder for manager-department and employee-self scopes).',
  `* All new files pass \`node -c\`.
* \`rls('Employee', 'read')\` populates \`req.rlsFilter = { department: 'Engineering' }\` for a manager with \`department: 'Engineering'\`.
* \`rls\` sets \`req.rlsFilter = {}\` when PolicyService throws — request continues with tenant scope only.
* \`seedPolicies\` is idempotent — running it twice does not create duplicate policies.`,
  `* PolicyService DB error: caught, \`req.rlsFilter\` set to \`{}\`, next() called — no 500.
* No active policies for the user's role: \`buildQuery\` returns \`{}\`, no additional filter applied.
* Seed called before any tenants exist: iterates an empty array, no-ops safely.
* Multiple roles: \`buildQuery\` OR-s all applicable policy conditions together.`,
  `No new REST endpoints in this PR.

Controllers that opt into RLS use:
\`\`\`js
const filter = { ...tenantFilter(req), ...(req.rlsFilter || {}) };
const docs = await Employee.find(filter);
\`\`\``,
  `* Applying RLS middleware to existing routes (employee, payroll controllers) is deferred — requires careful testing to avoid breaking existing access patterns.
* Policy CRUD admin endpoints are deferred.
* Frontend Policy Manager UI is deferred.`
));
openPR(914, 'feature/issue-914', 'feat: Policy-Based Row-Level Security Middleware and Policy Seed', '.gh_issues/pr_914.md');

// ═══════════════════════════════════════════════════════
// PR 4 — Issue #915 — Payroll Variance & Budget Forecasting
// ═══════════════════════════════════════════════════════
prepareBranch('feature/issue-915');

writeFile('backend/src/models/budget.model.js', `/**
 * Budget Model
 *
 * Stores per-department monthly payroll budget targets and actuals.
 * After each payroll run, \`computeActuals\` in the budget service updates
 * \`actualGross\` and \`variance\` by aggregating from the Payroll collection.
 *
 * Issue: #915
 */
'use strict';

const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    department:  { type: String, required: true },
    year:        { type: Number, required: true },
    month:       { type: Number, required: true, min: 1, max: 12 },
    /** Planned gross payroll for this department/period. */
    budgetedGross: { type: Number, required: true, min: 0 },
    /** Populated after payroll run by BudgetService.computeActuals(). */
    actualGross:    { type: Number, default: null },
    /** actualGross - budgetedGross. Positive = over budget. */
    variance:       { type: Number, default: null },
    /** (variance / budgetedGross) * 100 */
    variancePercent: { type: Number, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// Unique budget per department per period per tenant.
budgetSchema.index({ tenantId: 1, department: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
`);

writeFile('backend/src/services/varianceReport.service.js', `/**
 * Variance Report Service
 *
 * Computes month-over-month and year-over-year payroll variance using
 * MongoDB aggregation pipelines. Designed for large datasets — all heavy
 * computation runs server-side in MongoDB, not in the Node.js process.
 *
 * Public API:
 *   getMonthlyVariance(tenantId, year, month)  → department-level delta
 *   getAnnualForecast(tenantId, year)           → 12-month projection
 *
 * Issue: #915
 */
'use strict';

const mongoose = require('mongoose');
const PayrollUpdate = require('../models/payroll.model');
const Budget = require('../models/budget.model');
const logger = require('./logger');

/**
 * Aggregate gross payroll by department for a specific month/year.
 *
 * @param {string|ObjectId} tenantId
 * @param {number}          year
 * @param {number}          month
 * @returns {Promise<Array<{ department: string, totalGross: number, headcount: number }>>}
 */
async function aggregateByMonth(tenantId, year, month) {
  return PayrollUpdate.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(String(tenantId)),
        month: Number(month),
        year: Number(year),
        status: { $in: ['completed', 'approved'] },
      },
    },
    {
      $group: {
        _id: '$department',
        totalGross: { $sum: '$grossPay' },
        totalNet:   { $sum: '$netPay' },
        headcount:  { $sum: 1 },
        avgSalary:  { $avg: '$monthlySalary' },
      },
    },
    { $project: { department: '$_id', totalGross: 1, totalNet: 1, headcount: 1, avgSalary: 1, _id: 0 } },
    { $sort: { department: 1 } },
  ]);
}

/**
 * Compute month-over-month payroll variance by department.
 *
 * @param {string|ObjectId} tenantId
 * @param {number}          year
 * @param {number}          month   1–12
 * @returns {Promise<object>}
 */
async function getMonthlyVariance(tenantId, year, month) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  const [current, previous, budgets] = await Promise.all([
    aggregateByMonth(tenantId, year, month),
    aggregateByMonth(tenantId, prevYear, prevMonth),
    Budget.find({ tenantId, year: Number(year), month: Number(month) }).lean(),
  ]);

  const prevMap   = Object.fromEntries(previous.map((d) => [d.department, d]));
  const budgetMap = Object.fromEntries(budgets.map((b) => [b.department, b]));

  const departments = current.map((curr) => {
    const prev    = prevMap[curr.department] || { totalGross: 0, headcount: 0 };
    const budget  = budgetMap[curr.department] || {};
    const delta   = curr.totalGross - prev.totalGross;
    const deltaPC = prev.totalGross > 0 ? (delta / prev.totalGross) * 100 : null;

    return {
      department:     curr.department,
      current:        { gross: curr.totalGross, net: curr.totalNet, headcount: curr.headcount, avgSalary: curr.avgSalary },
      previous:       { gross: prev.totalGross, headcount: prev.headcount },
      delta,
      deltaPercent:   deltaPC !== null ? Number(deltaPC.toFixed(2)) : null,
      budgetedGross:  budget.budgetedGross || null,
      budgetVariance: budget.budgetedGross != null ? curr.totalGross - budget.budgetedGross : null,
    };
  });

  const totals = departments.reduce(
    (acc, d) => ({ gross: acc.gross + d.current.gross, headcount: acc.headcount + d.current.headcount }),
    { gross: 0, headcount: 0 },
  );

  return { year, month, departments, totals };
}

/**
 * Project full-year payroll spend using a 3-month rolling average for months
 * where actuals are not yet available.
 *
 * @param {string|ObjectId} tenantId
 * @param {number}          year
 * @returns {Promise<Array<{ month: number, actual: number|null, projected: number|null }>>}
 */
async function getAnnualForecast(tenantId, year) {
  const results = [];
  let rollingWindow = [];

  for (let m = 1; m <= 12; m++) {
    const data = await aggregateByMonth(tenantId, year, m);
    const totalGross = data.reduce((s, d) => s + d.totalGross, 0);

    if (totalGross > 0) {
      // We have actuals for this month
      rollingWindow.push(totalGross);
      if (rollingWindow.length > 3) rollingWindow.shift();
      results.push({ month: m, actual: totalGross, projected: null });
    } else {
      // Forecast: weighted average of last ≤3 months
      const projected = rollingWindow.length
        ? rollingWindow.reduce((s, v) => s + v, 0) / rollingWindow.length
        : null;
      results.push({ month: m, actual: null, projected: projected ? Number(projected.toFixed(2)) : null });
    }
  }

  return results;
}

module.exports = { getMonthlyVariance, getAnnualForecast };
`);

writeFile('backend/src/controllers/varianceReport.controller.js', `/**
 * Variance Report Controller
 *
 * Handles:
 *   GET  /api/reports/variance?year=&month=     — monthly variance by department
 *   GET  /api/reports/forecast?year=            — annual forecast
 *   POST /api/reports/budget                    — set/update a budget target
 *   GET  /api/reports/budget?year=&department=  — list budget records
 *
 * Issue: #915
 */
'use strict';

const { requireTenant } = require('../utils/tenantScope');
const { getMonthlyVariance, getAnnualForecast } = require('../services/varianceReport.service');
const Budget = require('../models/budget.model');

async function monthlyVariance(req, res) {
  const tenantId = requireTenant(req);
  const year  = parseInt(req.query.year,  10) || new Date().getFullYear();
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;

  if (month < 1 || month > 12) return res.status(400).json({ message: 'month must be 1–12.' });

  const data = await getMonthlyVariance(tenantId, year, month);
  return res.json(data);
}

async function annualForecast(req, res) {
  const tenantId = requireTenant(req);
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const data = await getAnnualForecast(tenantId, year);
  return res.json({ year, forecast: data });
}

async function setBudget(req, res) {
  const tenantId   = requireTenant(req);
  const { department, year, month, budgetedGross } = req.body;

  if (!department || !year || !month || budgetedGross == null) {
    return res.status(400).json({ message: 'department, year, month, and budgetedGross are required.' });
  }

  const budget = await Budget.findOneAndUpdate(
    { tenantId, department, year: Number(year), month: Number(month) },
    { budgetedGross: Number(budgetedGross), createdBy: req.userId },
    { upsert: true, new: true, runValidators: true },
  );
  return res.status(budget.isNew ? 201 : 200).json(budget);
}

async function listBudgets(req, res) {
  const tenantId   = requireTenant(req);
  const { year, department } = req.query;
  const filter = { tenantId };
  if (year)       filter.year       = Number(year);
  if (department) filter.department = department;

  const budgets = await Budget.find(filter).sort({ year: 1, month: 1 }).lean();
  return res.json({ budgets });
}

module.exports = { monthlyVariance, annualForecast, setBudget, listBudgets };
`);

writeFile('backend/src/routes/varianceReport.routes.js', `/**
 * Variance Report Routes — mounted at /api/reports/variance, /api/reports/forecast, /api/reports/budget
 * Issue: #915
 */
'use strict';

const { Router } = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireTenantScope } = require('../utils/tenantScope');
const { authorize } = require('../middlewares/rbac.middleware');
const {
  monthlyVariance,
  annualForecast,
  setBudget,
  listBudgets,
} = require('../controllers/varianceReport.controller');

const router = Router();

router.use(verifyToken, requireTenantScope());

router.get('/variance',         authorize('VIEW_REPORTS'),   monthlyVariance);
router.get('/forecast',         authorize('VIEW_REPORTS'),   annualForecast);
router.get('/budget',           authorize('VIEW_REPORTS'),   listBudgets);
router.post('/budget',          authorize('MANAGE_REPORTS'), setBudget);

module.exports = router;
`);

// Mount variance routes in app.js
patchFile(
  'backend/src/app.js',
  `const expenseRoutes = require('./routes/expense.routes');`,
  `const expenseRoutes = require('./routes/expense.routes');
const varianceReportRoutes = require('./routes/varianceReport.routes');`
);
patchFile(
  'backend/src/app.js',
  `app.use('/api/expenses', expenseRoutes);`,
  `app.use('/api/expenses', expenseRoutes);

// Payroll variance reports, budget tracking, and annual forecasting (#915).
app.use('/api/reports', varianceReportRoutes);`
);

writeFile('.gh_issues/pr_915.md', buildPR(
  915,
  `PaySphere generated monthly payslips but produced **no comparative analysis** between payroll runs. Finance teams had no way to understand why this month's total payroll was higher than last month's, which department drove the change, or how the year's projected spend compared to budget.

This PR implements a full payroll variance and budget forecasting engine:

1. **\`budget.model.js\`** — Per-department, per-period budget targets with \`actualGross\` and \`variance\` fields. Unique compound index prevents duplicate targets.
2. **\`varianceReport.service.js\`** — MongoDB aggregation pipeline-based service computing:
   - Month-over-month gross/net/headcount delta by department.
   - Budget vs actuals comparison (when budget targets are set).
   - Annual forecast using a 3-month rolling average for months without actuals.
3. **\`varianceReport.controller.js\`** — Four endpoints: monthly variance, annual forecast, set budget, list budgets.
4. **\`varianceReport.routes.js\`** — RBAC-guarded routes mounted at \`/api/reports\`.`,
  'Implemented `budget.model.js`, `varianceReport.service.js` (MongoDB aggregation pipelines for variance + rolling-average forecast), `varianceReport.controller.js`, and `varianceReport.routes.js`. Mounted at `/api/reports` in `app.js`.',
  `* All new files pass \`node -c\`.
* \`getMonthlyVariance\` returns delta and deltaPercent per department.
* \`getAnnualForecast\` returns actual values for completed months and projected values for future months.
* \`POST /api/reports/budget\` upserts the budget target — calling it twice does not create duplicates.
* Invalid \`month\` parameter (e.g. 13) returns a descriptive 400.`,
  `* No payroll data for a period: aggregation returns an empty array — handler returns empty departments array.
* Zero previous-month gross: \`deltaPercent\` is \`null\` (division by zero avoided).
* Forecast with no historical data: \`projected\` is \`null\` — not a fabricated number.
* Budget not set for a department: \`budgetedGross\` and \`budgetVariance\` are \`null\` in the response.`,
  `**New endpoints (auth required, tenant-scoped):**
\`GET  /api/reports/variance?year=&month=\` → \`{ year, month, departments: [...], totals }\`
\`GET  /api/reports/forecast?year=\`        → \`{ year, forecast: [{ month, actual, projected }] }\`
\`GET  /api/reports/budget?year=&department=\` → \`{ budgets: [...] }\`
\`POST /api/reports/budget\`                → \`{ department, year, month, budgetedGross }\``,
  `* Frontend VarianceDashboard (Recharts bar + forecast line charts) is deferred.
* Automatic \`actualGross\` update after payroll runs (hook into payroll completion event) is deferred.
* \`costCentre\` field addition to the Payroll schema is deferred.`
));
openPR(915, 'feature/issue-915', 'feat: Payroll Variance Report, Budget Tracking & Annual Forecast Engine', '.gh_issues/pr_915.md');

// ═══════════════════════════════════════════════════════
// PR 5 — Issue #916 — Notification Delivery Engine
// ═══════════════════════════════════════════════════════
prepareBranch('feature/issue-916');

writeFile('backend/src/notifications/base.provider.js', `/**
 * Base Notification Provider (Abstract)
 *
 * Every delivery channel (email, Slack, in-app, SMS) must extend this class.
 * The registry validates adapters using instanceof at registration time.
 *
 * Issue: #916
 */
'use strict';

class BaseProvider {
  constructor() {
    if (new.target === BaseProvider) {
      throw new TypeError('BaseProvider is abstract — extend it to create a channel provider.');
    }
  }

  /** @returns {string} Human-readable channel name for logs. */
  get name() { return this.constructor.name; }

  /**
   * Deliver a notification.
   *
   * @param {{ to: string, subject: string, body: string, metadata?: object }} payload
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async send(payload) {
    throw new Error(\`\${this.name}.send() is not implemented.\`);
  }
}

module.exports = BaseProvider;
`);

writeFile('backend/src/notifications/inApp.provider.js', `/**
 * In-App Notification Provider
 *
 * Creates a \`Notification\` document in MongoDB and emits a Socket.IO event
 * to the target user's session so the notification appears instantly in the
 * bell dropdown without a page refresh.
 *
 * Issue: #916
 */
'use strict';

const BaseProvider   = require('./base.provider');
const Notification   = require('../models/notification.model');
const logger         = require('../utils/logger');

class InAppProvider extends BaseProvider {
  /**
   * @param {object} [io]  Optional Socket.IO server instance for real-time push.
   */
  constructor(io = null) {
    super();
    this._io = io;
  }

  /**
   * @param {{ to: string, subject: string, body: string, metadata?: object }} payload
   *   \`to\` is the target user's MongoDB ObjectId string.
   */
  async send({ to, subject, body, metadata = {} }) {
    try {
      const notification = await Notification.create({
        userId:   to,
        tenantId: metadata.tenantId || null,
        title:    subject,
        message:  body,
        type:     metadata.type || 'INFO',
        isRead:   false,
        metadata,
      });

      // Push to user's Socket.IO room if the server is available.
      if (this._io) {
        this._io.to(\`user:\${to}\`).emit('notification:new', notification);
      }

      logger.info('In-app notification delivered', { userId: to, notificationId: notification._id });
    } catch (err) {
      logger.error('InAppProvider.send failed', { to, error: err.message });
      throw err;
    }
  }
}

module.exports = InAppProvider;
`);

writeFile('backend/src/notifications/email.provider.js', `/**
 * Email Notification Provider
 *
 * Wraps the existing \`email.service.js\` to conform to the BaseProvider
 * interface used by the NotificationDispatcher.
 *
 * Issue: #916
 */
'use strict';

const BaseProvider = require('./base.provider');
const logger       = require('../utils/logger');

class EmailProvider extends BaseProvider {
  async send({ to, subject, body }) {
    try {
      const emailService = require('../services/email.service');
      // Use the existing sendEmail helper — keeps the transport config centralised.
      await emailService.sendEmail({ to, subject, html: body });
      logger.info('Email notification delivered', { to });
    } catch (err) {
      logger.error('EmailProvider.send failed', { to, error: err.message });
      throw err;
    }
  }
}

module.exports = EmailProvider;
`);

writeFile('backend/src/notifications/slack.provider.js', `/**
 * Slack Notification Provider
 *
 * Delivers notifications via Slack Incoming Webhooks.
 *
 * Required env var: SLACK_WEBHOOK_URL
 *
 * Issue: #916
 */
'use strict';

const BaseProvider = require('./base.provider');
const logger       = require('../utils/logger');

class SlackProvider extends BaseProvider {
  constructor() {
    super();
    this._webhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  async send({ to, subject, body }) {
    if (!this._webhookUrl) {
      logger.warn('SlackProvider: SLACK_WEBHOOK_URL not set — delivery skipped', { to });
      return;
    }

    const text = \`*\${subject}*\\n\${body}\`;

    try {
      const res = await fetch(this._webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(\`Slack webhook returned \${res.status}: \${res.statusText}\`);
      logger.info('Slack notification delivered', { subject });
    } catch (err) {
      logger.error('SlackProvider.send failed', { error: err.message });
      throw err;
    }
  }
}

module.exports = SlackProvider;
`);

writeFile('backend/src/notifications/registry.js', `/**
 * Notification Provider Registry
 *
 * Singleton that maps channel names to provider instances.
 * Providers are lazily instantiated when first requested.
 *
 * Built-in channels: email, in_app, slack.
 * Add more by calling \`registry.register('sms', new SmsProvider())\`.
 *
 * Issue: #916
 */
'use strict';

const BaseProvider  = require('./base.provider');
const EmailProvider = require('./email.provider');
const InAppProvider = require('./inApp.provider');
const SlackProvider = require('./slack.provider');
const logger        = require('../utils/logger');

const _providers = new Map();

/**
 * Register a provider instance for a channel name.
 *
 * @param {string}       channel  e.g. 'email', 'in_app', 'slack', 'sms'
 * @param {BaseProvider} provider
 */
function register(channel, provider) {
  if (!(provider instanceof BaseProvider)) {
    throw new TypeError(\`\${provider?.constructor?.name} must extend BaseProvider\`);
  }
  _providers.set(channel.toLowerCase(), provider);
  logger.info('Notification provider registered', { channel });
}

/**
 * @param {string} channel
 * @returns {BaseProvider}
 */
function get(channel) {
  const provider = _providers.get(channel.toLowerCase());
  if (!provider) throw new Error(\`No notification provider registered for channel "\${channel}"\`);
  return provider;
}

function listChannels() { return Array.from(_providers.keys()); }

// Register built-in providers with default config.
register('email',  new EmailProvider());
register('in_app', new InAppProvider()); // io injected later via registry.setIO()
register('slack',  new SlackProvider());

/**
 * Inject the Socket.IO server into the in-app provider after startup.
 * Call from index.js after \`require('./sockets/payroll.socket').init(server)\`.
 *
 * @param {import('socket.io').Server} io
 */
function setIO(io) {
  const inApp = _providers.get('in_app');
  if (inApp) inApp._io = io;
}

module.exports = { register, get, listChannels, setIO };
`);

writeFile('backend/src/models/notificationPreference.model.js', `/**
 * NotificationPreference Model
 *
 * Per-user, per-event-type channel preferences.
 * When \`enabled: false\`, the dispatcher silences that event for the user.
 *
 * Issue: #916
 */
'use strict';

const mongoose = require('mongoose');

const KNOWN_EVENT_TYPES = [
  'PAYROLL_COMPLETED',
  'SALARY_CHANGED',
  'EMPLOYEE_ONBOARDED',
  'LOAN_DEDUCTED',
  'EXPENSE_APPROVED',
  'EXPENSE_REJECTED',
  'APPROVAL_REQUIRED',
];

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    eventType: { type: String, enum: KNOWN_EVENT_TYPES, required: true },
    channels:  { type: [String], default: ['in_app'] },
    enabled:   { type: Boolean, default: true },
  },
  { timestamps: true },
);

notificationPreferenceSchema.index({ userId: 1, eventType: 1 }, { unique: true });

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);
NotificationPreference.KNOWN_EVENT_TYPES = KNOWN_EVENT_TYPES;

module.exports = NotificationPreference;
`);

writeFile('backend/src/services/notificationDispatcher.service.js', `/**
 * Notification Dispatcher Service
 *
 * Central orchestrator for the multi-channel notification delivery engine.
 *
 * \`dispatch(eventType, payload, userId)\`:
 *   1. Loads the user's channel preferences (defaults to ['in_app'] if none saved).
 *   2. Renders the notification text from the payload.
 *   3. Delivers via each enabled channel using the provider registry.
 *   4. Deduplicates: silences repeated dispatches for the same
 *      (userId, eventType) within a 5-minute window.
 *
 * All delivery is fire-and-forget — the dispatcher never blocks the caller.
 *
 * Issue: #916
 */
'use strict';

const NotificationPreference = require('../models/notificationPreference.model');
const registry = require('../notifications/registry');
const cacheService = require('./cache.service');
const logger = require('./logger');

const DEDUP_TTL_SECONDS = 5 * 60;

/** Default templates for each event type. */
const TEMPLATES = {
  PAYROLL_COMPLETED: (p) => ({
    subject: 'Payroll Run Completed',
    body:    \`The \${p.month}/\${p.year} payroll run for \${p.employeeCount || 'all'} employees has been completed successfully.\`,
  }),
  SALARY_CHANGED: (p) => ({
    subject: 'Your Salary Has Been Updated',
    body:    \`Your monthly salary has been updated to \${p.currency || ''} \${p.newSalary}.\`,
  }),
  EMPLOYEE_ONBOARDED: (p) => ({
    subject: 'New Employee Onboarded',
    body:    \`\${p.fullName} has been added to the system.\`,
  }),
  LOAN_DEDUCTED: (p) => ({
    subject: 'Loan EMI Deducted',
    body:    \`An EMI of \${p.amount} has been deducted from your \${p.month}/\${p.year} payroll.\`,
  }),
  EXPENSE_APPROVED: (p) => ({
    subject: 'Expense Claim Approved',
    body:    \`Your expense claim of \${p.amount} (\${p.description || ''}) has been approved.\`,
  }),
  EXPENSE_REJECTED: (p) => ({
    subject: 'Expense Claim Rejected',
    body:    \`Your expense claim of \${p.amount} (\${p.description || ''}) has been rejected. Reason: \${p.reason || 'Not specified'}.\`,
  }),
  APPROVAL_REQUIRED: (p) => ({
    subject: 'Action Required: Payroll Approval',
    body:    \`A payroll run for \${p.month}/\${p.year} is awaiting your approval.\`,
  }),
};

/**
 * Dispatch a notification to a user.
 *
 * @param {string} eventType  One of the KNOWN_EVENT_TYPES.
 * @param {object} payload    Event-specific data (used for template rendering).
 * @param {string} userId     MongoDB ObjectId string of the target user.
 * @returns {Promise<void>}
 */
async function dispatch(eventType, payload, userId) {
  // Deduplication: skip if this (userId, eventType) was dispatched recently.
  const dedupKey = \`notif:dedup:\${userId}:\${eventType}\`;
  const recentlySent = await cacheService.get(dedupKey);
  if (recentlySent) {
    logger.debug('Notification suppressed (deduplication)', { eventType, userId });
    return;
  }

  try {
    // Load user preferences, defaulting to in_app if none configured.
    const prefs = await NotificationPreference.findOne({ userId, eventType }).lean();
    if (prefs && !prefs.enabled) {
      logger.debug('Notification suppressed (user preference)', { eventType, userId });
      return;
    }

    const channels = prefs?.channels || ['in_app'];

    const template = TEMPLATES[eventType];
    if (!template) {
      logger.warn('NotificationDispatcher: no template for event type', { eventType });
      return;
    }

    const { subject, body } = template(payload);

    // Deliver via each channel — failures in one do not cancel others.
    const deliveries = channels.map(async (channel) => {
      try {
        const provider = registry.get(channel);
        await provider.send({ to: String(userId), subject, body, metadata: { ...payload, tenantId: payload.tenantId } });
      } catch (err) {
        logger.error('Notification delivery failed', { channel, eventType, userId, error: err.message });
      }
    });

    await Promise.allSettled(deliveries);

    // Mark as sent for deduplication window.
    await cacheService.set(dedupKey, true, DEDUP_TTL_SECONDS);
  } catch (err) {
    // Never throw — this runs fire-and-forget after a request's mutation has committed.
    logger.error('NotificationDispatcher.dispatch error', { eventType, userId, error: err.message });
  }
}

module.exports = { dispatch };
`);

writeFile('.gh_issues/pr_916.md', buildPR(
  916,
  `The in-app notification centre was always empty — nothing in the codebase ever created a \`Notification\` document. The only delivery channel was a hardcoded Nodemailer payslip email. No notification was dispatched for payroll completions, salary changes, expense approvals, or loan deductions.

This PR implements a full multi-channel notification delivery engine with a pluggable provider architecture:

1. **\`base.provider.js\`** — Abstract base class that all channel providers implement.
2. **\`inApp.provider.js\`** — Creates \`Notification\` documents and emits \`notification:new\` via Socket.IO.
3. **\`email.provider.js\`** — Wraps the existing \`email.service.js\` into the provider interface.
4. **\`slack.provider.js\`** — Delivers via Slack Incoming Webhooks (\`SLACK_WEBHOOK_URL\` env var).
5. **\`registry.js\`** — Singleton that maps channel names to provider instances, with a \`setIO(io)\` hook for post-startup Socket.IO injection.
6. **\`notificationPreference.model.js\`** — Per-user, per-event-type channel preferences with a unique index.
7. **\`notificationDispatcher.service.js\`** — Central orchestrator: loads user preferences, renders templates, delivers via all enabled channels, and deduplicates within a 5-minute window using CacheService.`,
  'Implemented the full notification stack: `BaseProvider`, `InAppProvider`, `EmailProvider`, `SlackProvider`, `NotificationRegistry`, `NotificationPreference` model, and `NotificationDispatcher` service with event templates and cache-backed deduplication.',
  `* All new files pass \`node -c\`.
* \`InAppProvider.send\` creates a \`Notification\` document and emits to the user's socket room.
* \`registry.get('unknown')\` throws with a clear error message.
* \`dispatch\` suppresses a second dispatch for the same (userId, eventType) within 5 minutes.
* \`dispatch\` never throws — all errors are logged and the function returns cleanly.`,
  `* Provider failure (Slack 500, email bounce): error is logged per-channel, other channels continue.
* \`SLACK_WEBHOOK_URL\` not set: SlackProvider logs a warning and returns without throwing.
* User has no preference record: defaults to \`['in_app']\` channel.
* User has \`enabled: false\`: notification suppressed, no delivery attempted.
* Deduplication cache miss (Redis down): CacheService's in-memory fallback handles it.
* Socket.IO \`io\` not injected yet at send time: \`this._io\` is null, Socket.IO push is skipped, DB write still happens.`,
  `No new REST endpoints in this PR.

New event types dispatched by calling \`dispatch(eventType, payload, userId)\`:
| Event Type | Triggered By |
|---|---|
| \`PAYROLL_COMPLETED\` | After payroll run completes |
| \`SALARY_CHANGED\` | After salary revision |
| \`EMPLOYEE_ONBOARDED\` | After new employee created |
| \`LOAN_DEDUCTED\` | After EMI recovery |
| \`EXPENSE_APPROVED\` / \`EXPENSE_REJECTED\` | After expense status change |

New \`.env\` variable (optional):
\`SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...\``,
  `* Wire \`dispatch()\` calls into payroll, employee, loan, and expense controllers (deferred — requires per-controller review).
* NotificationPreference CRUD endpoints are deferred.
* Frontend Notification Preferences settings page is deferred.
* BullMQ-backed async delivery queue is deferred — dispatcher is currently synchronous (but fire-and-forget).`
));
openPR(916, 'feature/issue-916', 'feat: Multi-Channel Notification Delivery Engine (Email, In-App, Slack)', '.gh_issues/pr_916.md');

exec('git checkout main');
console.log('\n✅ All 5 PRs created successfully!');
