import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/reportController.js";

const router = Router();

router.use(requireAuth);

router.get("/summary", ctrl.summary);
router.get("/trend", ctrl.trend);
router.get("/category-breakdown", ctrl.categoryBreakdown);

export default router;
