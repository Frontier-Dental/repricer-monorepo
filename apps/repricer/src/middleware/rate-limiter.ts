import rateLimit from "express-rate-limit";
import { applicationConfig } from "../utility/config";

// Strict limiter for login attempts
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    status: "ERROR",
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip + ":" + req.body.email, // Per IP + email
});

// Moderate limiter for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 attempts per hour
  message: {
    status: "ERROR",
    message: "Too many password reset requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: Number(applicationConfig.RATE_LIMIT_WINDOW_MS) * 60 * 1000, // windowMs minutes
  max: 100, // 100 requests per minute
  message: {
    status: "ERROR",
    message: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
