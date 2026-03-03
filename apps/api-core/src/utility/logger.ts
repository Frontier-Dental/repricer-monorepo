import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import { applicationConfig } from "./config";
import { LogLevel } from "../types/logger.types";

const logDir = applicationConfig.APP_LOG_PATH;

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

// JSON format for file output
const fileFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json());

// Create the logger
const logger = winston.createLogger({
  level: applicationConfig.LOG_LEVEL as LogLevel,
  defaultMeta: {
    service: "api-core",
    environment: applicationConfig.NODE_ENV,
  },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Error log file (rotated daily)
    new DailyRotateFile({
      filename: path.join(logDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      format: fileFormat,
      maxFiles: "30d",
      maxSize: "20m",
    }),
    // Combined log file (rotated daily)
    new DailyRotateFile({
      filename: path.join(logDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      format: fileFormat,
      maxFiles: "14d",
      maxSize: "20m",
    }),
  ],
});

// Create child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};

export default logger;
