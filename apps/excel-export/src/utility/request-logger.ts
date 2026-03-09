import { Request, Response, NextFunction } from "express";
import { createLogger } from "./logger";

const logger = createLogger("http");

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log request
  logger.info("Incoming request", {
    method: req.method,
    url: req.url,
    userAgent: req.get("user-agent"),
  });

  // Log response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;
    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
    return originalSend.call(this, data);
  };

  next();
};
