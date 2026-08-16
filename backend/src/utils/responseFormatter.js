/**
 * Unified Response Formatter Class
 * Standardizes successful and error response structures across the API.
 */
class ResponseFormatter {
  /**
   * Format a successful response.
   * @param {*} data - The payload to send back.
   * @param {string} [message] - Optional human-readable message.
   * @returns {Object} Structured success object
   */
  static success(data = null, message = undefined) {
    return {
      success: true,
      data,
      ...(message !== undefined ? { message } : {}),
    };
  }

  /**
   * Format an error response.
   * @param {string} message - Primary human-readable error message.
   * @param {*} [details] - Nested validation or system details.
   * @param {string|number} [code] - Internal error identifier.
   * @returns {Object} Structured error object
   */
  static error(message, details = null, code = null) {
    return {
      success: false,
      error: {
        message,
        ...(details !== null ? { details } : {}),
        ...(code !== null ? { code } : {}),
      },
    };
  }
}

module.exports = ResponseFormatter;
