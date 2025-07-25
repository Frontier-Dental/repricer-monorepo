import { createLogger, format, transports, Logger } from "winston";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { applicationConfig } from "./config";
dotenv.config();

const { combine, timestamp, json } = format;
const LogFilePath: string = applicationConfig.APP_LOG_PATH;

export const rotateLogFiles = (
  logger: Logger,
  maxSizeInBytes: number,
): void => {
  const logFilename = LogFilePath;
  const newFilename = path.join("logs", `app-${Date.now()}.log`);

  fs.stat(logFilename, (err, stats) => {
    if (err) {
      console.error("Error getting file stats:", err);
      return;
    }

    if (stats.size >= maxSizeInBytes) {
      fs.rename(logFilename, newFilename, (renameErr) => {
        if (renameErr) {
          console.error("Error renaming log file:", renameErr);
        } else {
          console.log(`Log file renamed to ${newFilename}`);
          // @ts-ignore
          (logger.transports as any).fileStream = fs.createWriteStream(
            logFilename,
            {
              flags: "a",
              encoding: "utf8",
            },
          );
        }
      });
    }
  });
};

export const logger: Logger = createLogger({
  format: combine(timestamp(), json()),
  transports: [
    new transports.File({
      filename: LogFilePath,
      maxsize: 380 * 1024 * 1024, // Set max size to 350 MB (350 * 1024 * 1024 bytes)
      maxFiles: 100, // keep latest 5 log files
    }),
  ],
});

// logger.add(new transports.Console());
