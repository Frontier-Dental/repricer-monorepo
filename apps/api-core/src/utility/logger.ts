import winston from "winston";
import util from "util";
import { applicationConfig } from "./config";
import { LogLevel } from "../types/logger.types";

const SPLAT = Symbol.for("splat");

const levelMap: Record<string, string> = {
  error: "ERROR",
  warn: "WARNING",
  info: "INFO",
  debug: "DEBUG",
};

// Console-only format for stdout (e.g. Datadog agent collects from here)
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

// Create the logger - console only; logs are forwarded to Datadog via stdout
const logger = winston.createLogger({
  level: applicationConfig.LOG_LEVEL as LogLevel,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// Create child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};

export default logger;
