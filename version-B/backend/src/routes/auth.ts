// ===========================================
// FinTrack Backend - Auth Routes
// ===========================================

import { Router } from "express";
import { authLimiter, publicLimiter } from "../middleware/rateLimiter";
import { validateBody, validateQuery } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";
import {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  googleLogin,
  googleCallback,
} from "../controllers/authController";
import { registerSchema, loginSchema, refreshTokenSchema } from "../middleware/validation";

const router = Router();

// POST /api/v1/auth/register - Register new user
router.post("/register", authLimiter, validateBody(registerSchema), register);

// POST /api/v1/auth/login - Login with email/password
router.post("/login", authLimiter, validateBody(loginSchema), login);

// POST /api/v1/auth/refresh - Refresh access token
router.post("/refresh", publicLimiter, validateBody(refreshTokenSchema), refreshToken);

// POST /api/v1/auth/logout - Logout user
router.post("/logout", requireAuth, logout);

// GET /api/v1/auth/profile - Get current user profile
router.get("/profile", requireAuth, getProfile);

// PUT /api/v1/auth/profile - Update user profile
router.put("/profile", requireAuth, updateProfile);

// PUT /api/v1/auth/change-password - Change password
router.put("/change-password", requireAuth, changePassword);

// DELETE /api/v1/auth/account - Delete user account
router.delete("/account", requireAuth, deleteAccount);

// GET /api/v1/auth/google - Initiate Google OAuth2 login
router.get("/google", publicLimiter, googleLogin);

// GET /api/v1/auth/google/callback - Google OAuth2 callback
router.get("/google/callback", publicLimiter, googleCallback);

export default router;
