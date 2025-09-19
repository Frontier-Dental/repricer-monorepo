import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { applicationConfig } from "./config";

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  console.error("=== ERROR MIDDLEWARE ===");
  if (err && err.stack) {
    console.error(err.stack);
  } else {
    console.error(err);
  }

  if (res.headersSent) {
    return next(err);
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      message: err?.message || "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && {
        stack: err?.stack,
      }),
    },
  });
};
