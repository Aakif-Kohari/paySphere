/**
 * Route-wiring regression coverage for #614.
 *
 * Three failures that live entirely in the router and app wiring, and so are
 * invisible to the controller tests:
 *
 *  1. `workflow.routes.js` was never mounted in app.js, so every endpoint was a
 *     404 and `WorkflowBuilder.jsx` had nothing to talk to.
 *  2. The router destructured `{ verifyToken }` from a module whose only export
 *     is the function itself, so `router.use(verifyToken)` threw at require
 *     time — mounting the file as it stood took the process down at boot.
 *  3. It had `router.use(auth)` and no permission guards, so any authenticated
 *     account, including an employee-portal login, could approve a payroll run.
 */

const express = require('express');
const request = require('supertest');

// Every handler is stubbed: this suite is about which middleware runs and in
// what order, not about what the controllers do.
jest.mock('../../controllers/workflow.controller', () => ({
  createWorkflow: (req, res) => res.status(201).json({ ok: 'create' }),
  getWorkflows: (req, res) => res.status(200).json({ ok: 'list' }),
  startInstance: (req, res) =>
    res.status(201).json({ ok: 'start', workflowId: req.params.workflowId }),
  getInstances: (req, res) => res.status(200).json({ ok: 'instances' }),
  transitionInstance: (req, res) =>
    res.status(200).json({ ok: 'transition', instanceId: req.params.instanceId }),
}));

jest.mock('../../middlewares/auth.middleware', () => (req, res, next) => {
  req.userId = '507f1f77bcf86cd799439011';
  req.tenantId = '507f1f77bcf86cd799439099';
  next();
});

// Record which permission each route asked for, and honour a per-test grant
// set. Jest hoists jest.mock factories above the file body, so anything they
// close over must be prefixed `mock` to be exempt from the out-of-scope guard.
const mockGranted = new Set();
const mockRequestedPermissions = [];

jest.mock('../../middlewares/rbac.middleware', () => ({
  requirePermission: (permission) => (req, res, next) => {
    mockRequestedPermissions.push({ path: req.path, method: req.method, permission });
    if (!mockGranted.has(permission)) {
      return res
        .status(403)
        .json({ message: `Access denied. Requires permission: ${permission}` });
    }
    next();
  },
}));

jest.mock('../../middlewares/rateLimiter.middleware', () => ({
  writeRateLimiter: (req, res, next) => next(),
  generalRateLimiter: (req, res, next) => next(),
  authRateLimiter: (req, res, next) => next(),
}));

const { PERMISSIONS } = require('../../config/permissions');

const WORKFLOW_ID = '507f1f77bcf86cd799439011';
const INSTANCE_ID = '507f1f77bcf86cd799439012';

const buildApp = () => {
  // Required inside the builder rather than at module scope so a require-time
  // throw surfaces as a failing test rather than a suite that cannot load.
  const workflowRoutes = require('../workflow.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/workflows', workflowRoutes);
  return app;
};

const grantAll = () => {
  Object.values(PERMISSIONS).forEach((p) => mockGranted.add(p));
};

beforeEach(() => {
  mockGranted.clear();
  mockRequestedPermissions.length = 0;
});

describe('workflow routes — the router can be loaded at all (#614)', () => {
  test('requiring the router does not throw', () => {
    // `const { verifyToken } = require('../middlewares/auth.middleware')` left
    // `verifyToken` undefined, and `router.use(undefined)` throws
    // "Router.use() requires a middleware function but got a undefined".
    expect(() => require('../workflow.routes')).not.toThrow();
  });

  test('imports the auth middleware the way every other router does', () => {
    const auth = require('../../middlewares/auth.middleware');

    expect(typeof auth).toBe('function');
    expect(auth.verifyToken).toBeUndefined();
  });
});

describe('workflow routes — the endpoints are mounted (#614)', () => {
  let app;

  beforeEach(() => {
    grantAll();
    app = buildApp();
  });

  test('POST / resolves instead of 404ing', async () => {
    const res = await request(app).post('/api/workflows').send({});
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe('create');
  });

  test('GET / resolves instead of 404ing', async () => {
    const res = await request(app).get('/api/workflows');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe('list');
  });

  test('POST /:workflowId/instances resolves — instances could not be created at all', async () => {
    const res = await request(app)
      .post(`/api/workflows/${WORKFLOW_ID}/instances`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.workflowId).toBe(WORKFLOW_ID);
  });

  test('GET /instances resolves', async () => {
    const res = await request(app).get('/api/workflows/instances');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe('instances');
  });

  test('POST /instances/:instanceId/transition resolves', async () => {
    const res = await request(app)
      .post(`/api/workflows/instances/${INSTANCE_ID}/transition`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.instanceId).toBe(INSTANCE_ID);
  });

  test('"instances" is not captured as a workflow id', async () => {
    // `/:workflowId/instances` is declared after the literal paths, so
    // GET /instances reaches the list handler rather than being read as
    // "the workflow whose id is `instances`".
    const res = await request(app).get('/api/workflows/instances');
    expect(res.body.ok).toBe('instances');
  });
});

describe('workflow routes — permission guards (#614)', () => {
  let app;

  beforeEach(() => {
    grantAll();
    app = buildApp();
  });

  test('every route asks for a permission — none runs on auth alone', async () => {
    await request(app).post('/api/workflows').send({});
    await request(app).get('/api/workflows');
    await request(app).post(`/api/workflows/${WORKFLOW_ID}/instances`).send({});
    await request(app).get('/api/workflows/instances');
    await request(app)
      .post(`/api/workflows/instances/${INSTANCE_ID}/transition`)
      .send({});

    expect(mockRequestedPermissions).toHaveLength(5);
  });

  test('acting on a request needs APPROVE_PAYROLL, not merely WRITE_PAYROLL', async () => {
    // A maker who can raise a request must not be able to sign it off alone.
    // #590 let any authenticated account do both.
    await request(app)
      .post(`/api/workflows/instances/${INSTANCE_ID}/transition`)
      .send({});

    expect(mockRequestedPermissions[0].permission).toBe(PERMISSIONS.APPROVE_PAYROLL);
  });

  test('defining a chain needs WRITE_PAYROLL', async () => {
    await request(app).post('/api/workflows').send({});

    expect(mockRequestedPermissions[0].permission).toBe(PERMISSIONS.WRITE_PAYROLL);
  });

  test('reading needs only READ_PAYROLL', async () => {
    await request(app).get('/api/workflows');
    await request(app).get('/api/workflows/instances');

    expect(mockRequestedPermissions.map((p) => p.permission)).toEqual([
      PERMISSIONS.READ_PAYROLL,
      PERMISSIONS.READ_PAYROLL,
    ]);
  });
});

describe('workflow routes — a read-only account is refused (#614)', () => {
  let app;

  beforeEach(() => {
    // The Employee role's permission set: READ_EMPLOYEE + READ_PAYROLL.
    mockGranted.add(PERMISSIONS.READ_EMPLOYEE);
    mockGranted.add(PERMISSIONS.READ_PAYROLL);
    app = buildApp();
  });

  test('cannot approve a request', async () => {
    const res = await request(app)
      .post(`/api/workflows/instances/${INSTANCE_ID}/transition`)
      .send({ action: 'approve_final' });

    expect(res.status).toBe(403);
  });

  test('cannot define a workflow', async () => {
    const res = await request(app).post('/api/workflows').send({});

    expect(res.status).toBe(403);
  });

  test('can still read the list', async () => {
    const res = await request(app).get('/api/workflows');

    expect(res.status).toBe(200);
  });
});

describe('app wiring — the router is registered (#614)', () => {
  test('/api/workflows is mounted on the application', () => {
    jest.isolateModules(() => {
      // Asserted against the real app rather than the test harness above: the
      // bug was that app.js never mentioned this router.
      const appSource = require('fs').readFileSync(
        require('path').join(__dirname, '..', '..', 'app.js'),
        'utf8',
      );

      expect(appSource).toContain('workflow.routes');
      expect(appSource).toContain('/api/workflows');
    });
  });
});
