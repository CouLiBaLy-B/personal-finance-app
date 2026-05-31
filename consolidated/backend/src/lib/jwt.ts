/**
 * JWT helpers — sign, verify, hash refresh tokens.
 */
import jwt from "jsonwebtoken";
import crypto from "crypto";

const secret = process.env.JWT_SECRET ?? "";

export function ensureJwtSecret(): void {
  if (
    !secret ||
    secret.includes("change-me") ||
    secret.length < 32
  ) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET must be set to a strong random value (≥32 chars) in production."
      );
    }
    console.warn(
      "⚠️  JWT_SECRET is using the default value. Set a strong secret for production."
    );
  }
}

export interface TokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(userId: string, email: string): string {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "1d";
  return jwt.sign({ sub: userId, email } as TokenPayload, secret, {
    expiresIn: expiresIn as any,
  });
}

export function signRefreshToken(userId: string): string {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";
  return jwt.sign({ sub: userId } as { sub: string }, secret, {
    expiresIn: expiresIn as any,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}

/** Hash a refresh token before storing in DB (SHA-256). */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
