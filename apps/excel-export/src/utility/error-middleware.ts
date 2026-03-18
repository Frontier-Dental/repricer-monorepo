import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { applicationConfig } from "./config";
import logger from "./logger";

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction): void => {
  logger.error("=== ERROR MIDDLEWARE ===");
  if (err && err.stack) {
    logger.error(err.stack);
  } else {
    logger.error(err);
  }

  if (res.headersSent) {
    return next(err);
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      message: err?.message || "Internal Server Error",
      ...(applicationConfig.NODE_ENV === "development" && {
        stack: err?.stack,
      }),
    },
  });
};
