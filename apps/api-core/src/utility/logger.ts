import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import util from "util";
import { applicationConfig } from "./config";
import { LogLevel } from "../types/logger.types";

const SPLAT = Symbol.for("splat");

const logDir = applicationConfig.APP_LOG_PATH;

const levelMap: Record<string, string> = {
  error: "ERROR",
  warn: "WARNING",
  info: "INFO",
  debug: "DEBUG",
};

// Plain text format: full message when args are primitives (pattern 1), omit objects (pattern 2)
const consoleFormat = winston.format.combine(
  winston.format.errors({ stack: false }),
  winston.format.printf(({ level, message, module, [SPLAT]: splat, ...meta }) => {
    const ddLevel = levelMap[level] || level.toUpperCase();
    const prefix = module ? `[${module}]` : "";
    const isPrimitive = (v: unknown) => v === null || v === undefined || typeof v !== "object";
    const displayMessage = Array.isArray(splat) && splat.length > 0 ? util.format(message, ...splat.filter(isPrimitive)) : message;
    return `[${ddLevel}] ${prefix} ${displayMessage}`;
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
