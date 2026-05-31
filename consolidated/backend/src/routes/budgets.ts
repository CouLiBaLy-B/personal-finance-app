import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate, budgetCreateSchema, budgetUpdateSchema } from "../middleware/validation.js";
import * as ctrl from "../controllers/budgetController.js";

const router = Router();

router.use(requireAuth);

// Static routes BEFORE /:id
router.get("/current/status", ctrl.currentStatus);
router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", validate(budgetCreateSchema), ctrl.create);
router.put("/:id", validate(budgetUpdateSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

export default router;
