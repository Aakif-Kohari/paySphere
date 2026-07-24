const winston = require("winston");
const path = require("path");
require("winston-daily-rotate-file");

const logDir = path.join(__dirname, "../../logs");

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, "paysphere-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "30d",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.json()
  ),
});

const errorFileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "30d",
  level: "error",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.json()
  ),
});

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
  ),
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports: [fileRotateTransport, errorFileRotateTransport],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(consoleTransport);
}

logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
