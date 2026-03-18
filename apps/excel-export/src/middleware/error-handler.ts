import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/custom-errors";
import logger from "../utility/logger";

export const errorHandler = (err: Error | AppError, req: Request, res: Response, next: NextFunction): Response | void => {
  // Log the error
  const errorInfo = {
    message: err.message,
    url: req.url,
    method: req.method,
    ip: req.ip,
    stack: err.stack,
    ...(err instanceof AppError && { context: err.context }),
  };

  if (err instanceof AppError) {
    logger.error("Application error", errorInfo);

    // Send error response
    return res.status(err.statusCode).json({
      status: false,
      message: err.message,
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
        context: err.context,
      }),
    });
  }

  // Unexpected errors
  logger.error(`Unexpected error: ${errorInfo}`);

  // Don't leak error details in production
  const message = process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message;

  return res.status(500).json({
    status: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): Response => {
  logger.warn("Route not found", {
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  return res.status(404).json({
    status: false,
    message: `Route ${req.url} not found`,
  });
};
