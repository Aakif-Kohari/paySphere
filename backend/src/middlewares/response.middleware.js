const ResponseFormatter = require('../utils/responseFormatter');

/**
 * Express Middleware to mount helper methods `res.success` and `res.error` on the response object.
 */
const responseMiddleware = (req, res, next) => {
  /**
   * Helper to return standard JSON success response.
   * @param {*} data - Payload to return.
   * @param {string} [message] - Optional success message.
   * @param {number} [statusCode=200] - HTTP status code.
   */
  res.success = function (data = null, message = undefined, statusCode = 200) {
    return res.status(statusCode).json(ResponseFormatter.success(data, message));
  };

  /**
   * Helper to return standard JSON error response.
   * @param {string} message - Primary human-readable error message.
   * @param {*} [details=null] - Nested validation or system details.
   * @param {string|number} [code=null] - Internal error identifier.
   * @param {number} [statusCode=400] - HTTP status code.
   */
  res.error = function (message, details = null, code = null, statusCode = 400) {
    return res.status(statusCode).json(ResponseFormatter.error(message, details, code));
  };

  next();
};

module.exports = responseMiddleware;
