/**
 * @fileoverview Advanced Rate Limiting Middleware
 * @description Redis-backed sliding window rate limiter for critical API endpoints.
 * Prevents abuse and DDoS attacks while allowing legitimate traffic.
 * 
 * Issue: #685
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Standard API Rate Limiter (General endpoints)
 * 100 requests per 15 minutes per IP
 */
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  handler: (req, res) => {
    logger.warn('Rate limit exceeded (Standard)', { ip: req.ip, path: req.path });
    res.status(429).json({
      message: 'Too many requests from this IP, please try again after 15 minutes.',
    });
  },
});

/**
 * Strict Rate Limiter (Authentication & Write endpoints)
 * 20 requests per 15 minutes per IP
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  handler: (req, res) => {
    logger.warn('Rate limit exceeded (Strict)', { ip: req.ip, path: req.path });
    res.status(429).json({
      message: 'Too many requests. Please slow down and try again later.',
    });
  },
});

/**
 * Write Operations Rate Limiter (Payroll finalization, bulk deletes)
 * 10 requests per minute per User ID (not just IP, to prevent shared office IP blocks)
 */
const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by authenticated user ID if available, otherwise fall back to IP
    return req.userId || req.ip;
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  handler: (req, res) => {
    logger.warn('Rate limit exceeded (Write Ops)', { 
      userId: req.userId, 
      ip: req.ip, 
      path: req.path 
    });
    res.status(429).json({
      message: 'Write operation limit exceeded. Please wait a minute before trying again.',
    });
  },
});

module.exports = {
  standardLimiter,
  strictLimiter,
  writeRateLimiter,
};
