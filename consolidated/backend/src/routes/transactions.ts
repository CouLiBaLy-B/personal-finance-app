import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate, transactionCreateSchema, transactionUpdateSchema } from "../middleware/validation.js";
import { uploadSingle } from "../middleware/upload.js";
import * as ctrl from "../controllers/transactionController.js";

const router = Router();

router.use(requireAuth);

// Static routes BEFORE /:id
router.get("/export", ctrl.exportCsv);
router.post("/import", uploadSingle, ctrl.importCsv);
router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", validate(transactionCreateSchema), ctrl.create);
router.put("/:id", validate(transactionUpdateSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

export default router;
