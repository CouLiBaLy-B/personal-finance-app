// ===========================================
// FinTrack Backend - Auth Controller
// Handles user authentication (JWT + OAuth2)
// ===========================================

import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "passport";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger";
import {
  generateTokens,
  createSession,
  refreshTokens,
  invalidateSession,
  invalidateAllSessions,
  localAuthenticate,
  googleAuthenticate,
  jwtAuthenticate,
} from "../middleware/auth";
import { ValidationError, AuthenticationError, NotFoundError } from "../middleware/errorHandler";
import { registerSchema, loginSchema, refreshTokenSchema } from "../middleware/validation";

const prisma = new PrismaClient();

// ===========================================
// JWT Configuration
// ===========================================

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

// ===========================================
// Local Auth Controller
// ===========================================

/**
 * Register a new user
 */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate request
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ValidationError("Email already in use");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        fullName: data.fullName,
        baseCurrency: data.baseCurrency || "EUR",
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        baseCurrency: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Create session
    await createSession(user.id, refreshToken, req);

    logger.info(`User registered: ${user.email} (${user.id})`);

    res.status(201).json({
      success: true,
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
      message: "Registration successful",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login with email and password
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate request
    const data = loginSchema.parse(req.body);

    // Use Passport for authentication
    passport.authenticate("local", { session: false }, async (err, user, info) => {
      try {
        if (err) {
          throw err;
        }

        if (!user) {
          throw new AuthenticationError(info?.message || "Invalid email or password");
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user);

        // Create session
        await createSession(user.id, refreshToken, req);

        logger.info(`User logged in: ${user.email} (${user.id})`);

        res.json({
          success: true,
          data: {
            user,
            tokens: {
              accessToken,
              refreshToken,
            },
          },
          message: "Login successful",
        });
      } catch (error) {
        next(error);
      }
    })(req, res, next);
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const data = refreshTokenSchema.parse(req.body);

    const newTokens = await refreshTokens(data.refreshToken);

    if (!newTokens) {
      throw new AuthenticationError("Invalid or expired refresh token");
    }

    logger.info("Token refreshed");

    res.json({
      success: true,
      data: {
        tokens: newTokens,
      },
      message: "Token refreshed successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Logout user
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.headers["x-session-id"] as string | undefined;

    if (sessionId) {
      await invalidateSession(sessionId);
    } else {
      // Invalidate all sessions for the user
      const user = (req as any).user;
      if (user?.id) {
        await invalidateAllSessions(user.id);
      }
    }

    logger.info("User logged out");

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user profile
 */
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        baseCurrency: true,
        avatarUrl: true,
        googleId: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      throw new NotFoundError("User not found");
    }

    res.json({
      success: true,
      data: { user: profile },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user profile
 */
export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const data = req.body;

    // Remove fields that shouldn't be updated
    delete data.email;
    delete data.passwordHash;
    delete data.googleId;
    delete data.isVerified;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        baseCurrency: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    logger.info(`User profile updated: ${user.id}`);

    res.json({
      success: true,
      data: { user: updatedUser },
      message: "Profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change password
 */
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password hash
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new NotFoundError("User not found");
    }

    // Check current password
    const isValidPassword = await bcrypt.compare(currentPassword, dbUser.passwordHash);

    if (!isValidPassword) {
      throw new AuthenticationError("Current password is incorrect");
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate all sessions (force logout everywhere)
    await invalidateAllSessions(user.id);

    logger.info(`User password changed: ${user.id}`);

    res.json({
      success: true,
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete user account (RGPD compliance)
 */
export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user?.id) {
      throw new AuthenticationError();
    }

    // Delete all user data (cascade will handle most relations)
    await prisma.user.delete({
      where: { id: user.id },
    });

    logger.info(`User account deleted: ${user.id}`);

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// OAuth2 Controller (Google)
// ===========================================

/**
 * Initiate Google OAuth2 login
 */
export function googleLogin(req: Request, res: Response, next: NextFunction) {
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
  })(req, res, next);
}

/**
 * Google OAuth2 callback
 */
export async function googleCallback(req: Request, res: Response, next: NextFunction) {
  passport.authenticate("google", { session: false }, async (err, user, info) => {
    try {
      if (err) {
        throw err;
      }

      if (!user) {
        throw new AuthenticationError(info?.message || "Google authentication failed");
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);

      // Create session
      await createSession(user.id, refreshToken, req);

      logger.info(`User logged in via Google: ${user.email} (${user.id})`);

      // Redirect to frontend with tokens
      // In production, you might want to use cookies instead
      const frontendOrigin = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",")[0];
      const redirectUrl = new URL(frontendOrigin);
      redirectUrl.pathname = "/auth/callback";
      redirectUrl.searchParams.set("accessToken", accessToken);
      redirectUrl.searchParams.set("refreshToken", refreshToken);

      res.redirect(redirectUrl.toString());
    } catch (error) {
      next(error);
    }
  })(req, res, next);
}
