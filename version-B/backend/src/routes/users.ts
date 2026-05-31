// ===========================================
// FinTrack Backend - User Routes
// ===========================================

import { Router } from "express";
import { defaultLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { getAllUsers, getUserById, exportUserData } from "../controllers/userController";

const router = Router();

// GET /api/v1/users/export - Export all user data (RGPD)
router.get("/export", defaultLimiter, requireAuth, exportUserData);

// GET /api/v1/users - Get all users (admin only in future)
router.get("/", defaultLimiter, requireAuth, getAllUsers);

// GET /api/v1/users/:id - Get user by ID
router.get("/:id", defaultLimiter, requireAuth, getUserById);

export default router;
