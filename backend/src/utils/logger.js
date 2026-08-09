/**
 * @fileoverview Centralized Winston Logger Configuration
 * @description Replaces all console.log statements with a structured, production-ready 
 * logging system. Supports log rotation, JSON formatting for log aggregators (like ELK/Datadog), 
 * and colorized console output for development.
 * 
 * Issue: #723
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists before creating transports
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, json, colorize, errors } = winston.format;

/**
 * Custom format for development console output
 */
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  // Append metadata if present (excluding internal winston symbols)
  const metaKeys = Object.keys(meta).filter(k => !k.startsWith('Symbol'));
  if (metaKeys.length > 0) {
    msg += ` ${JSON.stringify(meta)}`;
  }

  return stack ? `${msg}\n${stack}` : msg;
});

/**
 * Transport: Daily Rotating Error Logs
 * Keeps error logs for 30 days, max 20MB per file
 */
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: combine(timestamp(), json()),
});

/**
 * Transport: Daily Rotating Combined Logs
 * Keeps all logs for 30 days (restored from original retention policy)
 */
const combinedRotateTransport = new DailyRotateFile({
  filename: path.join(logDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: combine(timestamp(), json()),
});

/**
 * Transport: Console (Colorized for Dev only, disabled in production)
 */
const consoleTransport = new winston.transports.Console({
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    devFormat
  ),
});

/**
 * Winston Logger Instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'paysphere-api',
    env: process.env.NODE_ENV || 'development',
  },
  transports: [
    errorRotateTransport,
    combinedRotateTransport,
  ],
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Only enable console transport outside of production
// Prevents double-logging in containerized/cloud environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(consoleTransport);
}

/**
 * Morgan-compatible stream for HTTP access logging
 * Usage: app.use(morgan('combined', { stream: logger.stream }))
 */
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

/**
 * Creates a child logger with specific context (e.g., for a specific module or request)
 * @param {Object} context - Metadata to inject into all logs from this child
 * @returns {winston.Logger} Child logger instance
 */
logger.createChild = (context) => {
  return logger.child(context);
};

module.exports = logger;
