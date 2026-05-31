// ===========================================
// FinTrack Backend - Rate Limiter Middleware
// ===========================================

import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import logger from "../utils/logger";

// Default rate limiter for most endpoints
const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    return {
      success: false,
      error: "Too many requests, please try again later.",
    };
  },
  skip: (req: Request) => {
    // Skip rate limiting for health check
    return req.path === "/api/v1/health";
  },
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    return (req as any).user?.id ? `user:${(req as any).user.id}` : req.ip;
  },
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 login attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: (req: Request, res: Response) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    return {
      success: false,
      error: "Too many login attempts. Please wait a minute before trying again.",
    };
  },
  skip: (req: Request) => {
    // Skip for health check
    return req.path === "/api/v1/health";
  },
});

// Loose rate limiter for public endpoints (like FX rates)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: (req: Request, res: Response) => {
    logger.warn(`Public rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    return {
      success: false,
      error: "Too many requests, please try again later.",
    };
  },
});

export { defaultLimiter, authLimiter, publicLimiter };
