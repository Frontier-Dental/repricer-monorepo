import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import { applicationConfig } from "./config";
import { LogLevel } from "../types/logger.types";

const logDir = applicationConfig.APP_LOG_PATH;

const levelMap: Record<string, string> = {
  error: "ERROR",
  warn: "WARNING",
  info: "INFO",
  debug: "DEBUG",
};

// Plain text format with Datadog-recognized level prefix (message only, no JSON meta)
const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, module, ...meta }) => {
    const ddLevel = levelMap[level] || level.toUpperCase();
    const prefix = module ? `[${module}]` : "";
    const stringMeta = Object.fromEntries(Object.entries(meta).filter(([k, v]) => k !== "timestamp" && typeof v === "string" && v.length < 50));
    const metaString = Object.keys(stringMeta).length ? JSON.stringify(stringMeta) : "";
    return `[${ddLevel}] ${prefix} ${message} ${metaString}`;
  })
);

// JSON format for file output
const fileFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json());

// Create the logger
const logger = winston.createLogger({
  level: applicationConfig.LOG_LEVEL as LogLevel,
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
