import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate, recurringCreateSchema, recurringUpdateSchema } from "../middleware/validation.js";
import * as ctrl from "../controllers/recurringController.js";

const router = Router();

router.use(requireAuth);

// Static routes BEFORE /:id
router.post("/generate", ctrl.generate);
router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", validate(recurringCreateSchema), ctrl.create);
router.put("/:id", validate(recurringUpdateSchema), ctrl.update);
router.delete("/:id", ctrl.remove);
router.post("/:id/skip", ctrl.skip);

export default router;
