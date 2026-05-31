import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./auth";
import crudRoutes from "./crud";
import importRoutes from "./import";
import reportsRoutes from "./reports";

/**
 * Point d'entrée unique des routes de l'API.
 * Toutes les routes sont préfixées "/api/v1/".
 *
 * /auth/*      → authentification (JWT + OAuth2 Google)
 * /accounts/*  → comptes
 * /categories/*→ catégories
 * /transactions/* → transactions
 * /budgets/*   → budgets
 * /goals/*     → objectifs
 * /recurring/* → transactions récurrentes
 * /import/*    → CSV import
 * /reports/*   → PDF bilan + JSON summary
 */
export function routes(prisma: PrismaClient): Router {
  const router = Router();

  router.use("/auth", authRoutes(prisma));
  router.use("/", crudRoutes(prisma));
  router.use("/import", importRoutes(prisma));
  router.use("/reports", reportsRoutes(prisma));

  return router;
}
