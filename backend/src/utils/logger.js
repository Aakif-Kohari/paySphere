const winston = require('winston');
const path = require('path');
const { redact } = require('./redaction');
require('winston-daily-rotate-file');

const logDir = path.join(__dirname, '../../logs');

const redactFormat = winston.format((info) => {
  const redacted = redact(info);
  return Object.assign(info, redacted);
})();

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'paysphere-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: winston.format.combine(
    redactFormat,
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),
  ),
});

const errorFileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(
    redactFormat,
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),
  ),
});

/**
 * Transport: Console (Colorized for Dev only, disabled in production)
 */
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    redactFormat,
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : '';
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    }),
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
  transports: [errorFileRotateTransport, fileRotateTransport],
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

/**
 * Transport: Production Console (Structured JSON for ELK/Elasticsearch)
 */
const productionConsoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    redactFormat,
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

// Enable structured JSON console logging in production for ELK/Elasticsearch,
// and colorized console logging in other environments (development, test).
if (process.env.NODE_ENV === 'production') {
  logger.add(productionConsoleTransport);
} else {
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
