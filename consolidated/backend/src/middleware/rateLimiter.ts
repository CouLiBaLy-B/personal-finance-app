/**
 * Rate limiting middleware.
 */
import rateLimit from "express-rate-limit";

/** Global rate limiter: 200 req / 15 min per IP. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Réessayez dans quelques minutes." },
});

/** Auth-specific limiter: 20 req / 15 min per IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Trop de tentatives d'authentification. Réessayez dans quelques minutes.",
  },
});

/** Strict limiter for sensitive operations: 5 req / 15 min. */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite atteinte pour cette opération sensible." },
});
