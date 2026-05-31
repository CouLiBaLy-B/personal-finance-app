import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/userController.js";

const router = Router();

router.use(requireAuth);

router.get("/me", ctrl.getMe);
router.get("/export", ctrl.exportData);

export default router;
