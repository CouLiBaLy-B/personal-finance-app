import { Router } from "express";
import * as ctrl from "../controllers/fxController.js";

const router = Router();

// FX routes are public (no auth required)
router.get("/currencies", ctrl.currencies);
router.get("/rates", ctrl.rates);
router.get("/convert", ctrl.convertAmount);

export default router;
