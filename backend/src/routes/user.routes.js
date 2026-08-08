const express = require("express");
const { signup, login, getSettings, updateSettings, updatePassword, googleAuth, forgotPassword, resetPassword, disconnectGoogle, deleteAccount,
    generate2FA, verifyAndEnable2FA,
    disable2FA,
    validate2FALogin, } = require("../controllers/user.controller");
const auth = require("../middlewares/auth.middleware");
const { authRateLimiter, writeRateLimiter } = require("../middlewares/rateLimiter.middleware");
const router = express.Router();


router.post("/signup", authRateLimiter, signup);
router.post("/login", authRateLimiter, login);
router.post("/google", authRateLimiter, googleAuth);
router.post("/forgot-password", authRateLimiter, forgotPassword);
router.post("/reset-password/:token", authRateLimiter, resetPassword);
router.post("/refresh", authRateLimiter, require("../controllers/user.controller").refresh);
router.post("/logout", authRateLimiter, require("../controllers/user.controller").logout);
router.post("/2fa/generate", authRateLimiter, auth, generate2FA);
router.post("/2fa/verify-and-enable", authRateLimiter, auth, verifyAndEnable2FA);
router.post("/2fa/disable", auth, disable2FA);
router.post("/2fa/validate-login", authRateLimiter, auth, validate2FALogin);

// Settings & Health
router.get("/settings", auth, getSettings);
router.patch("/settings", auth, writeRateLimiter, updateSettings);
router.patch("/security/password", auth, writeRateLimiter, updatePassword);
router.patch("/security/disconnect-google", auth, writeRateLimiter, disconnectGoogle);
router.delete("/security/account", auth, writeRateLimiter, deleteAccount);

module.exports = router;
