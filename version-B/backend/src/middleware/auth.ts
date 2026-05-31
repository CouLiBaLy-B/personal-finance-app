// ===========================================
// FinTrack Backend - Authentication Middleware
// Supports both JWT and OAuth2 (Google)
// ===========================================

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { PrismaClient, User } from "@prisma/client";
import logger from "../utils/logger";

const prisma = new PrismaClient();

// ===========================================
// JWT Configuration
// ===========================================

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

// JWT Options for Passport
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
  algorithms: ["HS256"],
};

// ===========================================
// Passport Strategies
// ===========================================

// JWT Strategy (for protected routes)
passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          fullName: true,
          baseCurrency: true,
          avatarUrl: true,
        },
      });

      if (!user) {
        return done(null, false, { message: "User not found" });
      }

      return done(null, user);
    } catch (error) {
      logger.error("JWT Strategy Error:", error);
      return done(error, false);
    }
  })
);

// Local Strategy (for email/password login)
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user) {
          return done(null, false, { message: "Invalid email or password" });
        }

        // Check if user has password (OAuth users might not have one)
        if (!user.passwordHash) {
          return done(null, false, { message: "User registered with OAuth, please use OAuth login" });
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);

        if (!isValidPassword) {
          return done(null, false, { message: "Invalid email or password" });
        }

        // Return user without sensitive data
        const { passwordHash, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        logger.error("Local Strategy Error:", error);
        return done(error, false);
      }
    }
  )
);

// Google OAuth2 Strategy (optional)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/api/v1/auth/google/callback",
        scope: ["profile", "email"],
        state: true,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, { message: "No email provided by OAuth provider" });
          }

          // Find or create user
          let user = await prisma.user.findFirst({
            where: {
              OR: [{ email }, { googleId: profile.id }],
            },
          });

          if (!user) {
            // Create new user with Google info
            user = await prisma.user.create({
              data: {
                email,
                fullName: profile.displayName,
                googleId: profile.id,
                baseCurrency: "EUR",
                isVerified: true,
                avatarUrl: profile.photos?.[0]?.value,
              },
            });
          } else if (!user.googleId) {
            // Link existing user with Google
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                avatarUrl: profile.photos?.[0]?.value,
                isVerified: true,
              },
            });
          }

          // Return user without sensitive data
          const { passwordHash, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword);
        } catch (error) {
          logger.error("Google Strategy Error:", error);
          return done(error, false);
        }
      }
    )
  );
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Generate JWT token and refresh token
 */
export function generateTokens(user: User): { accessToken: string; refreshToken: string } {
  const payload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    baseCurrency: user.baseCurrency,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  } catch (error) {
    logger.error("Token Verification Error:", error);
    return null;
  }
}

/**
 * Create session with refresh token
 */
export async function createSession(userId: string, refreshToken: string, req: Request): Promise<string> {
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.get("User-Agent") || "unknown";

  // Calculate expiry date for refresh token
  const expiresAt = new Date();
  const refreshExpiresIn = JWT_REFRESH_EXPIRES_IN.replace(/\D/g, "");
  expiresAt.setDate(expiresAt.getDate() + parseInt(refreshExpiresIn));

  const session = await prisma.session.create({
    data: {
      userId,
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt,
    },
  });

  return session.id;
}

/**
 * Validate refresh token and return new tokens
 */
export async function refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const payload = verifyToken(refreshToken);
  if (!payload || !payload.sub) {
    return null;
  }

  // Find session with this refresh token
  const session = await prisma.session.findFirst({
    where: {
      refreshToken,
      userId: payload.sub,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Generate new tokens
  const user = session.user;
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

  // Update session with new refresh token
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshToken: newRefreshToken },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Invalidate session (logout)
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { id: sessionId },
  });
}

/**
 * Invalidate all user sessions (force logout everywhere)
 */
export async function invalidateAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

// ===========================================
// Middleware Functions
// ===========================================

/**
 * Passport authenticate middleware for JWT
 */
export const jwtAuthenticate = passport.authenticate("jwt", { session: false });

/**
 * Passport authenticate middleware for local strategy
 */
export const localAuthenticate = passport.authenticate("local", { session: false });

/**
 * Passport authenticate middleware for Google OAuth2
 */
export const googleAuthenticate = passport.authenticate("google", {
  session: false,
  scope: ["profile", "email"],
});

/**
 * Custom middleware to check JWT in request
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authorization token required",
    });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);

  if (!payload || !payload.sub) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }

  // Attach user to request
  (req as any).user = payload;
  next();
}

/**
 * Middleware to check if user is authenticated (for routes)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const payload = verifyToken(token);
      if (payload?.sub) {
        (req as any).user = payload;
        return next();
      }
    }

    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }
  next();
}

/**
 * Middleware to check if user has specific role (extendable for future)
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // In FinTrack, all users are equal, but this can be extended
    // For now, just check authentication
    if (!(req as any).user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }
    next();
  };
}

export default passport;
