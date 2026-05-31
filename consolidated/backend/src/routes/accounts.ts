import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate, accountCreateSchema, accountUpdateSchema } from "../middleware/validation.js";
import * as ctrl from "../controllers/accountController.js";

const router = Router();

router.use(requireAuth);

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.get("/:id/balance", ctrl.getBalance);
router.post("/", validate(accountCreateSchema), ctrl.create);
router.put("/:id", validate(accountUpdateSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

export default router;
