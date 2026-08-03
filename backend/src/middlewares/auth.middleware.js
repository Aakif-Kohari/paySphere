const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { resolveAccountType } = require("../config/accountTypes");

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // `accountType` is selected alongside `role` because they answer different
    // questions and `authorize()` needs the former — see config/accountTypes.js
    // for why they are two fields rather than one (#558).
    const user = await User.findById(decoded.id).select(
      "_id isActive tokenVersion role accountType employeeId",
    );
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: "User not found or deactivated" });
    }

    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: "Token is no longer valid" });
    }

    req.userId = decoded.id;
    req.user = user;
    // Resolved once here so every downstream guard agrees on the answer, and so
    // an account on a not-yet-migrated database still gets a defensible type
    // instead of the old hardcoded "ADMIN" fallback.
    req.accountType = resolveAccountType(user);
    next();
} catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }};

module.exports = auth;
