const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models/dashboardLayout.model', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../middlewares/auth.middleware', () =>
  jest.fn((req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'No token provided' });
    }
    req.userId = req.headers['x-test-user'];
    req.tenantId = req.headers['x-test-tenant'];
    next();
  }),
);
jest.mock('../middlewares/rbac.middleware', () => ({
  requirePermission: () => (req, res, next) => next(),
}));
jest.mock('../controllers/dashboard.controller', () => ({
  getDashboardSummary: (req, res) => res.status(200).json({}),
}));

const DashboardLayout = require('../models/dashboardLayout.model');
const dashboardRoutes = require('../routes/dashboard.routes');
const requireBody = require('../middlewares/requireBody.middleware');
const errorHandler = require('../middlewares/error.middleware');

const APP_SOURCE = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');

const USER_ID = new mongoose.Types.ObjectId().toString();
const TENANT_ID = new mongoose.Types.ObjectId().toString();

/**
 * The dashboard router behind the same middleware order app.js gives it.
 *
 * Not `require("../app")`: that pulls in `user.controller` → `otplib`, which
 * ships ESM-only dependencies that this project's Jest setup cannot transform.
 * Every existing suite that requires the real app fails on it, so building the
 * slice under test here keeps this suite honest about what it is checking.
 */
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', requireBody);
  app.use('/api/dashboard', dashboardRoutes);
  app.use(errorHandler);
  return app;
};

const authed = (req) =>
  req
    .set('Authorization', 'Bearer test-token')
    .set('x-test-user', USER_ID)
    .set('x-test-tenant', TENANT_ID);

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * `/api/dashboard` used to be mounted twice (#663): once on the line directly
 * after `express()` — above the cookie parser, Helmet, morgan, CORS,
 * `express.json()`, the rate limiter and `requireBody` — and once at the bottom
 * with everything else. Express serves the first matching mount, so the winner
 * was the one with no middleware in front of it.
 */
describe('app — /api/dashboard mounting (#663)', () => {
  describe('mount', () => {
    test('is mounted exactly once', () => {
      const mounts = APP_SOURCE.match(/app\.use\(\s*['"]\/api\/dashboard['"]/g);

      expect(mounts).toHaveLength(1);
    });

    test('is mounted after the body parser, the rate limiter and requireBody', () => {
      const at = (needle) => APP_SOURCE.indexOf(needle);

      const dashboardMount = APP_SOURCE.search(
        /app\.use\(\s*['"]\/api\/dashboard['"]/,
      );

      expect(dashboardMount).toBeGreaterThan(at('app.use(cookieParser())'));
      expect(dashboardMount).toBeGreaterThan(at('app.use(helmet('));
      expect(dashboardMount).toBeGreaterThan(at('app.use(express.json('));
      expect(dashboardMount).toBeGreaterThan(at('app.use(cors(corsOptions))'));
      expect(dashboardMount).toBeGreaterThan(at('app.use("/api", requireBody)'));
      expect(dashboardMount).toBeGreaterThan(
        at('app.use("/api", generalRateLimiter)'),
      );
    });

    test('the router is required alongside the other routers, not above the app', () => {
      const requireLine = APP_SOURCE.indexOf('routes/dashboard.routes');
      const appConstruction = APP_SOURCE.indexOf('const app = express()');

      expect(requireLine).toBeGreaterThan(-1);
      expect(requireLine).toBeLessThan(appConstruction);
      expect(APP_SOURCE.match(/routes\/dashboard\.routes/g)).toHaveLength(1);
    });
  });

  describe('requests', () => {
    test('POST /layout without a token is 401, not a TypeError on an unparsed body', async () => {
      const res = await request(buildApp())
        .post('/api/dashboard/layout')
        .send({ order: ['card-1'] });

      expect(res.status).toBe(401);
      expect(DashboardLayout.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('GET /layout without a token is 401 — no more shared "anonymous" bucket', async () => {
      const res = await request(buildApp()).get('/api/dashboard/layout');

      expect(res.status).toBe(401);
      expect(DashboardLayout.findOne).not.toHaveBeenCalled();
    });

    test('an authenticated POST reaches the controller with a parsed body', async () => {
      DashboardLayout.findOneAndUpdate.mockResolvedValue({
        order: ['card-2', 'card-1'],
      });

      const res = await authed(
        request(buildApp()).post('/api/dashboard/layout'),
      ).send({ order: ['card-2', 'card-1'] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, order: ['card-2', 'card-1'] });
    });

    test('an authenticated PUT saves the layout for that user alone', async () => {
      DashboardLayout.findOneAndUpdate.mockResolvedValue({ order: ['card-1'] });

      await authed(request(buildApp()).put('/api/dashboard/layout')).send({
        order: ['card-1'],
      });

      expect(DashboardLayout.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: USER_ID },
        expect.objectContaining({
          $set: { order: ['card-1'], tenantId: TENANT_ID },
        }),
        expect.objectContaining({ upsert: true }),
      );
    });

    test('a POST with no body at all is a 400 from requireBody', async () => {
      const res = await authed(
        request(buildApp()).post('/api/dashboard/layout'),
      );

      expect(res.status).toBe(400);
      expect(DashboardLayout.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('a body whose order is not an array is a 400 from the controller', async () => {
      const res = await authed(
        request(buildApp()).post('/api/dashboard/layout'),
      ).send({ order: 'card-1' });

      expect(res.status).toBe(400);
      expect(DashboardLayout.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
