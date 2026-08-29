const { redact } = require("../utils/redaction");

const redactionMiddleware = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (body) {
    // Redact response if user is authenticated and is not an ADMIN,
    // or if the request is unauthenticated (non-admin by definition).
    const isAdmin = req.user && req.accountType === "ADMIN";

    let redactedBody = body;
    if (!isAdmin) {
      redactedBody = redact(body);
    }

    return originalJson.call(this, redactedBody);
  };

  next();
};

module.exports = redactionMiddleware;
