/**
 * Authentication middleware — JWT Bearer + Passport strategies.
 */
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";
import prisma from "../lib/prisma.js";
import { AppError } from "./errorHandler.js";

/** Extend Express Request with user info. */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Middleware: require a valid JWT in Authorization: Bearer <token>
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Token manquant. Veuillez vous authentifier.", 401);
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError("Token invalide ou expiré.", 401));
  }
}

/**
 * Middleware: optionally extract user from JWT (no error if absent).
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      req.userId = payload.sub;
      req.userEmail = payload.email;
    }
  } catch {
    // silently ignore invalid tokens
  }
  next();
}

/**
 * Helper: ensure the requested resource belongs to the authenticated user.
 */
export async function ensureOwnership(
  userId: string | undefined,
  resourceUserId: string
) {
  if (!userId || userId !== resourceUserId) {
    throw new AppError("Accès refusé.", 403);
  }
}
