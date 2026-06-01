/**
 * Global error handler middleware.
 */
import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { captureError } from "../lib/sentry.js";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational = true
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Prisma errors
  if ((err as any).code === "P2025") {
    return res.status(404).json({ error: "Ressource introuvable." });
  }
  if ((err as any).code === "P2002") {
    return res.status(409).json({ error: "Cette ressource existe déjà (doublon)." });
  }
  if ((err as any).code === "P2003") {
    return res
      .status(400)
      .json({ error: "Contrainte de clé étrangère violée." });
  }

  // Zod validation
  if (err.name === "ZodError") {
    const issues = (err as any).issues ?? (err as any).errors ?? [];
    return res.status(400).json({
      error: "Données invalides.",
      details: issues.map((i: any) => ({
        field: i.path?.join("."),
        message: i.message,
      })),
    });
  }

  logger.error("Unhandled error:", err);
  captureError(err, { path: _req.path, method: _req.method });
  return res.status(500).json({
    error: "Erreur interne du serveur.",
    ...(process.env.NODE_ENV === "development" && {
      message: err.message,
      stack: err.stack,
    }),
  });
}
