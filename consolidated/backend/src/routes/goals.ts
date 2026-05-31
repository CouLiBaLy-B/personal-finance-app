import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate, goalCreateSchema, goalUpdateSchema, goalContributeSchema } from "../middleware/validation.js";
import * as ctrl from "../controllers/goalController.js";

const router = Router();

router.use(requireAuth);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", validate(goalCreateSchema), ctrl.create);
router.put("/:id", validate(goalUpdateSchema), ctrl.update);
router.delete("/:id", ctrl.remove);
router.post("/:id/contribute", validate(goalContributeSchema), ctrl.contribute);
router.patch("/:id/complete", ctrl.markComplete);

export default router;
