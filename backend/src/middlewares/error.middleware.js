const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error('Internal Error', {
    error: err.message,
    stack: err.stack,
    method: req?.method,
    url: req?.originalUrl,
    userId: req?.userId,
    ip: req?.ip,
  });

  // A scoped query was attempted without a tenant (#612). This is an
  // authorization outcome, not a crash: the request reached a handler that can
  // only answer for one company and could not tell which one. The alternative —
  // letting the query run — is what returned every customer's rows, because
  // mongoose deletes `{ tenantId: undefined }` out of a filter rather than
  // matching nothing. See utils/tenantScope.js.
  if (err.name === 'MissingTenantError') {
    return res.status(err.status || 403).json({
      message:
        'Your account is not linked to a company yet. Sign in again to continue.',
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res
      .status(400)
      .json({ message: 'Validation error. Please check the input data.' });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res
      .status(409)
      .json({ message: 'Duplicate entry found. The record already exists.' });
  }

  // Multer errors (if not caught earlier)
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: 'File upload error' });
  }

  // Generic 500 server error
  const response = { message: 'Internal server error' };

  if (process.env.NODE_ENV === 'development') {
    response.error = err.message;
  }

  res.status(500).json(response);
};

module.exports = errorHandler;
