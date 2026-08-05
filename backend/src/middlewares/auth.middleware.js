const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { resolveAccountType } = require("../config/accountTypes");
const { ensureTenantForUser } = require("../services/tenant.service");
const { isUsableTenantId } = require("../utils/tenantScope");

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // `accountType` is selected alongside `role` because they answer different
    // questions and `authorize()` needs the former — see config/accountTypes.js
    // for why they are two fields rather than one (#558).
    //
    // `companyName` and `tenantId` join them for #612: the tenant is resolved
    // from the account rather than trusted from the token, and provisioning one
    // needs a name to give it.
    const user = await User.findById(decoded.id).select(
      "_id isActive tokenVersion role accountType employeeId tenantId companyName fullName",
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

    // The tenant comes from the account, not from `decoded.tenantId` (#612).
    //
    // #585 read the claim straight off the token. Refresh tokens live seven
    // days, so every session opened before a tenant existed kept carrying
    // `tenantId: undefined` for a week afterwards — and an undefined tenant is
    // not a filter that matches nothing, it is a filter mongoose deletes, which
    // turns every scoped read into an unscoped one. Reading the user document
    // (already loaded above) makes the fix take effect on the next request
    // instead of the next login.
    //
    // The token claim is still honoured as a fallback so a request whose
    // account row lags behind is not left unscoped, and `ensureTenantForUser`
    // provisions one for accounts the migration has not reached. It never
    // throws: a request that still has no tenant is left unscoped on purpose,
    // and utils/tenantScope.js then refuses it with a 403 rather than letting an
    // unfiltered query through.
    req.tenantId = user.tenantId
      || (isUsableTenantId(decoded.tenantId) ? decoded.tenantId : null)
      || (await ensureTenantForUser(user));

    next();
} catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }};

module.exports = auth;
