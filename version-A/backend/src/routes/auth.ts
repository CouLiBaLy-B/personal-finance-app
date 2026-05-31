import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import rateLimit from "express-rate-limit";
import {
  RegisterSchema,
  LoginSchema,
  signToken,
  hashPassword,
  comparePassword,
  generateGoogleOAuthUrl,
  verifyGoogleIdToken,
  verifyToken,
} from "../middleware/auth";
import { logger } from "../utils/logger";
import { seedDefaultCategories } from "../utils/seed";

// Rate limit spécial auth : 10 essais / minute
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Trop de tentatives de connexion. Réessayez dans une minute.",
});

export default function authRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // ============== POST /register ==============
  router.post("/register", authLimiter, async (req: Request, res: Response) => {
    try {
      const body = RegisterSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ error: "Données invalides", details: body.error.errors });
      }
      const { email, password, fullName, baseCurrency } = body.data;
      const normalizedEmail = email.trim().toLowerCase();

      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return res.status(409).json({ error: "Un compte existe déjà avec cet email." });
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: fullName.trim() || normalizedEmail,
          baseCurrency: (baseCurrency ?? "EUR").toUpperCase(),
        },
      });

      // Seed catégories + compte par défaut
      await seedDefaultCategories(prisma, user.id, user.baseCurrency);

      const token = signToken(user);
      logger.info(`[AUTH] Inscription — ${user.email}`);
      return res.status(201).json({
        token,
        user: { id: user.id, email: user.email, fullName: user.fullName, baseCurrency: user.baseCurrency },
      });
    } catch (err) {
      logger.error("[AUTH][register]", err);
      return res.status(500).json({ error: "Erreur interne lors de l'inscription" });
    }
  });

  // ============== POST /login ==============
  router.post("/login", authLimiter, async (req: Request, res: Response) => {
    try {
      const body = LoginSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ error: "Identifiants invalides" });
      }
      const { email, password } = body.data;
      const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (!user) {
        return res.status(401).json({ error: "Identifiants invalides" });
      }
      const ok = await comparePassword(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "Identifiants invalides" });
      }
      const token = signToken(user);
      logger.info(`[AUTH] Connexion — ${user.email}`);
      return res.json({
        token,
        user: { id: user.id, email: user.email, fullName: user.fullName, baseCurrency: user.baseCurrency },
      });
    } catch (err) {
      logger.error("[AUTH][login]", err);
      return res.status(500).json({ error: "Erreur interne lors de la connexion" });
    }
  });

  // ============== POST /oauth/google ==============
  router.post("/oauth/google", async (req: Request, res: Response) => {
    try {
      const { idToken } = req.body as { idToken?: string };
      if (!idToken) return res.status(400).json({ error: "idToken requis" });

      const googleUser = await verifyGoogleIdToken(idToken);
      if (!googleUser) return res.status(401).json({ error: "Token Google invalide" });

      let user = await prisma.user.findUnique({ where: { email: googleUser.email } });
      if (!user) {
        const passwordHash = await hashPassword("oauth_" + Math.random().toString(36));
        user = await prisma.user.create({
          data: { email: googleUser.email, passwordHash, fullName: googleUser.fullName, baseCurrency: "EUR" },
        });
        await seedDefaultCategories(prisma, user.id, user.baseCurrency);
      }

      const token = signToken(user);
      logger.info(`[AUTH][Google] ${user.email}`);
      return res.json({
        token,
        user: { id: user.id, email: user.email, fullName: user.fullName, baseCurrency: user.baseCurrency },
      });
    } catch (err) {
      logger.error("[AUTH][google]", err);
      return res.status(500).json({ error: "Erreur OAuth Google" });
    }
  });

  // ============== GET /oauth/google/url ==============
  router.get("/oauth/google/url", (_req: Request, res: Response) => {
    const url = generateGoogleOAuthUrl();
    return res.json({ url, configured: url !== "#" });
  });

  // ============== GET /me (validation token) ==============
  router.get("/me", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token absent" });
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Token invalide" });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
    return res.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, baseCurrency: user.baseCurrency },
    });
  });

  return router;
}
