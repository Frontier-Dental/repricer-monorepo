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

  if (err?.response?.data) {
    console.error("Response data:", JSON.stringify(err.response.data, null, 2));
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
