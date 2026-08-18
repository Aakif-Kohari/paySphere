const express = require("express");
const { signup, login, getSettings, updateSettings, googleAuth } = require("../controllers/user.controller");
const auth = require("../middlewares/auth.middleware");
const { validateRequest } = require("../middlewares/validate.middleware");
const { signupSchema, loginSchema } = require("../validations/schemas");
const router = express.Router();

router.post("/signup", validateRequest(signupSchema), signup);
router.post("/login", validateRequest(loginSchema), login);
router.post("/google", googleAuth);

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
