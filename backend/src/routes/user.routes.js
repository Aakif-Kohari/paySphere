const express = require("express");
const { signup, login, getSettings, updateSettings, googleAuth } = require("../controllers/user.controller");
const auth = require("../middlewares/auth.middleware");
const { validateRequest } = require("../middlewares/validate.middleware");
const { signupSchema, loginSchema } = require("../validations/schemas");
const router = express.Router();

router.post("/signup", validateRequest(signupSchema), signup);
router.post("/login", validateRequest(loginSchema), login);
router.post("/google", googleAuth);

// Settings
router.get("/settings", auth, getSettings);
router.put("/settings", auth, updateSettings);

module.exports = router;
