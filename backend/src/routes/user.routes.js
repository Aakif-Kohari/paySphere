const express = require('express');
const {
  signup,
  login,
  getSettings,
  updateSettings,
  googleAuth,
  githubAuth,
  forgotPassword,
  resetPassword,
  generate2FA,
  verifyAndEnable2FA,
  disable2FA,
  validate2FALogin,
  updatePassword,
  disconnectGoogle,
  deleteAccount,
  impersonateUser,
  stopImpersonation,
} = require('../controllers/user.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { validateRequest } = require('../middlewares/validate.middleware');
const { signupSchema, loginSchema } = require('../validations/schemas');
const {
  authRateLimiter,
  writeRateLimiter,
} = require('../middlewares/rateLimiter.middleware');
const validateRecaptcha = require('../middlewares/recaptcha.middleware');
const { generateCsrfToken } = require('../middlewares/csrf.middleware');
const router = express.Router();

router.post('/signup', validateRequest(signupSchema), signup);
router.post('/login', validateRequest(loginSchema), login);
router.post('/google', googleAuth);
router.get('/csrf-token', generateCsrfToken);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login to an existing account
 *     tags:
 *       - Authentication
 *     description: Authenticates user credentials and returns user details.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: dev@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authRateLimiter, validateRecaptcha, login);
router.post('/google', authRateLimiter, googleAuth);
router.post('/github', authRateLimiter, githubAuth);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password/:token', authRateLimiter, resetPassword);
router.post(
  '/refresh',
  authRateLimiter,
  require('../controllers/user.controller').refresh,
);
router.post(
  '/logout',
  authRateLimiter,
  require('../controllers/user.controller').logout,
);
router.post('/2fa/generate', authRateLimiter, auth, generate2FA);
router.post(
  '/2fa/verify-and-enable',
  authRateLimiter,
  auth,
  verifyAndEnable2FA,
);
router.post('/2fa/disable', auth, disable2FA);
router.post('/2fa/validate-login', authRateLimiter, auth, validate2FALogin);

router.post(
  '/impersonate',
  authRateLimiter,
  auth,
  requirePermission(PERMISSIONS.IMPERSONATE_USER),
  impersonateUser,
);
router.post('/stop-impersonation', authRateLimiter, auth, stopImpersonation);

const { setupMFA, verifyMFASetup } = require('../middlewares/mfa.middleware');
router.post('/mfa/setup', auth, setupMFA);
router.post('/mfa/verify', auth, verifyMFASetup);

// Settings & Health
router.get('/settings', auth, getSettings);
router.patch('/settings', auth, writeRateLimiter, updateSettings);
router.patch('/security/password', auth, writeRateLimiter, updatePassword);
router.patch(
  '/security/disconnect-google',
  auth,
  writeRateLimiter,
  disconnectGoogle,
);
router.delete('/security/account', auth, writeRateLimiter, deleteAccount);

module.exports = router;
