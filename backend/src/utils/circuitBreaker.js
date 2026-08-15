/**
 * @fileoverview Circuit Breaker Utility
 * @description Wraps external service calls (e.g., SMTP, third-party APIs) 
 * in an Opossum circuit breaker. Prevents cascading failures and reduces 
 * latency when external dependencies are down by failing fast.
 * 
 * Issue: #685
 */

const CircuitBreaker = require('opossum');
const logger = require('./logger');

/**
 * Registry of active circuit breakers for monitoring and metrics
 */
const breakerRegistry = new Map();

/**
 * Default options for all circuit breakers
 */
const defaultOptions = {
    timeout: 10000, // If the function takes longer than 10s, trigger a failure
    errorThresholdPercentage: 50, // If 50% of requests fail, trip the circuit
    resetTimeout: 30000, // After 30s, try again (half-open state)
    volumeThreshold: 5, // Minimum number of requests before calculating threshold
};

/**
 * Wraps an async function in a circuit breaker
 * 
 * @param {Function} fn - The async function to protect
 * @param {string} name - Unique name for the breaker (for logging/metrics)
 * @param {Object} options - Opossum options override
 * @returns {CircuitBreaker} The configured circuit breaker instance
 */
function createCircuitBreaker(fn, name, options = {}) {
    if (breakerRegistry.has(name)) {
        return breakerRegistry.get(name);
    }

    const breaker = new CircuitBreaker(fn, {
        ...defaultOptions,
        ...options,
        name,
    });

    // Event listeners for monitoring
    breaker.on('open', () => {
        logger.warn(`Circuit breaker OPEN for ${name}. Failing fast.`, { service: name });
    });

    breaker.on('halfOpen', () => {
        logger.info(`Circuit breaker HALF-OPEN for ${name}. Testing connection...`, { service: name });
    });

    breaker.on('close', () => {
        logger.info(`Circuit breaker CLOSED for ${name}. Service recovered.`, { service: name });
    });

    breaker.on('failure', (err) => {
        logger.error(`Circuit breaker failure for ${name}: ${err.message}`, {
            service: name,
            error: err.message
        });
    });

    breaker.fallback(() => {
        throw new Error(`Service ${name} is currently unavailable (Circuit Open)`);
    });

    breakerRegistry.set(name, breaker);
    return breaker;
}

/**
 * Gets the status of all registered circuit breakers (for health checks)
 * @returns {Object} Map of breaker names to their current state
 */
function getBreakerStatuses() {
    const statuses = {};
    for (const [name, breaker] of breakerRegistry.entries()) {
        statuses[name] = {
            state: breaker.status.stats,
            isOpen: breaker.opened,
            isHalfOpen: breaker.halfOpen,
            isClosed: breaker.closed,
        };
    }
    return statuses;
}

module.exports = {
    createCircuitBreaker,
    getBreakerStatuses,
};
