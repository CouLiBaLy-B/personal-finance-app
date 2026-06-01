import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate, syncPushSchema } from "../middleware/validation.js";
import * as ctrl from "../controllers/syncController.js";

const router = Router();

router.use(requireAuth);

router.get("/pull", ctrl.pull);
router.post("/push", validate(syncPushSchema), ctrl.push);

export default router;
