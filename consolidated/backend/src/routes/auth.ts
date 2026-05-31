import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter, strictLimiter } from "../middleware/rateLimiter.js";
import { validate, registerSchema, loginSchema, profileUpdateSchema, changePasswordSchema } from "../middleware/validation.js";
import * as ctrl from "../controllers/authController.js";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), ctrl.register);
router.post("/login", authLimiter, validate(loginSchema), ctrl.login);
router.post("/refresh", authLimiter, ctrl.refresh);
router.post("/logout", ctrl.logout);

// Protected routes
router.get("/me", requireAuth, ctrl.me);
router.put("/profile", requireAuth, validate(profileUpdateSchema), ctrl.updateProfile);
router.put("/change-password", requireAuth, validate(changePasswordSchema), ctrl.changePassword);
router.delete("/account", requireAuth, strictLimiter, ctrl.deleteAccount);

export default router;
