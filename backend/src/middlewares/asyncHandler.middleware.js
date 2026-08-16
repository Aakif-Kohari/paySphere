/**
 * @fileoverview Async Route Handler Wrapper
 * @description Wraps asynchronous Express route handlers to automatically 
 * catch rejected promises and forward them to the centralized error middleware.
 * Eliminates the need for `try/catch` blocks and `next(error)` in every controller.
 * 
 * Issue: #730
 */

/**
 * Wraps an async Express route handler
 * @param {Function} fn - The async route handler function
 * @returns {Function} Wrapped middleware function
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        // Execute the function and catch any synchronous or asynchronous errors
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = asyncHandler;