import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate, categoryCreateSchema, categoryUpdateSchema } from "../middleware/validation.js";
import * as ctrl from "../controllers/categoryController.js";

const router = Router();

router.use(requireAuth);

// Static routes BEFORE /:id
router.get("/tree", ctrl.tree);
router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", validate(categoryCreateSchema), ctrl.create);
router.put("/:id", validate(categoryUpdateSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

export default router;
