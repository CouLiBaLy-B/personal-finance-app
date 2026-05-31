/**
 * FinTrack — Backend API (Express + Prisma + PostgreSQL)
 *
 * Architecture :
 *   src/middleware/*.ts → middlewares (auth, validation, rate-limit)
 *   src/routes/*.ts     → routeurs métiers (auth, crud, import, reports)
 *   src/utils/*.ts      → logger, seed initial, helpers divers
 *   prisma/schema.prisma→ schéma de base de données Prisma
 *
 * Démarrage :
 *   $ pnpm run dev            (TSX watch — dev)
 *   $ pnpm run build && pnpm start (production)
 */

import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { logger, httpLogger, httpErrorLogger } from "./src/utils/logger";
import { routes } from "./src/routes";
import { processRecurringTransactions } from "./src/utils/recurring";

// ---------- Initialisation Prisma ----------
const prisma = new PrismaClient({
  log: ["error", "warn"],
});

prisma
  .$connect()
  .then(() => logger.info("[Prisma] Connexion PostgreSQL établie"))
  .catch((err) => {
    logger.error("[Prisma] Échec de connexion à la base de données", err);
    process.exit(1);
  });

// ---------- Application Express ----------
const app = express();

// Sécurité
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173,http://localhost:4173").split(",");
      if (!origin || allowed.includes(origin) || allowed.includes("*")) cb(null, true);
      else cb(new Error(`CORS: origine ${origin} non autorisée`));
    },
    credentials: true,
  })
);

// Body parsers + logger HTTP
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);

// Rate limiter global
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de requêtes, réessayez dans une minute." },
  })
);

// ---------- Routes ----------
app.use("/api/v1", routes(prisma));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Page / racine friendly pour vérifier que l'API démarre
app.get("/", (_req, res) => {
  res.send(`
    <!doctype html>
    <html lang="fr"><head>
      <meta charset="utf-8"/>
      <title>FinTrack API</title>
      <style>body{font-family:system-ui,sans-serif;margin:2rem;background:#f1f5f9}
             h1{color:#0ea5e9} code{background:#e2e8f0;padding:.2rem .4rem;border-radius:.25rem}</style>
    </head>
    <body>
      <h1>✅ FinTrack API est en ligne</h1>
      <p>Base URL : <code>/api/v1</code></p>
      <p>Santé : <code>GET /health</code></p>
      <p>Authentification : <code>POST /api/v1/auth/login</code> · <code>POST /api/v1/auth/register</code></p>
    </body></html>
  `);
});

// Log des erreurs + handler global
app.use(httpErrorLogger);
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("[GLOBAL ERROR]", err);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

// ---------- Démarrage ----------
const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  logger.info(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  logger.info(`🔒 CLIENT_ORIGIN = ${process.env.CLIENT_ORIGIN ?? "*"}`);
  logger.info(`📁 UPLOAD_DIR = ${process.env.UPLOAD_DIR ?? "./uploads"}`);
});

// ---------- Cron léger : rattrapage des récurrences ----------
// Toutes les 6 heures, on exécute un rattrapage global.
// En production, préférez un cron externe (Docker / Kubernetes cronjob).
setInterval(async () => {
  try {
    const n = await processRecurringTransactions(prisma);
    if (n > 0) logger.info(`[CRON][recurring] ${n} transaction(s) générée(s)`);
  } catch (err) {
    logger.error("[CRON][recurring]", err);
  }
}, 6 * 60 * 60 * 1000);

// Cleanup à l'arrêt
process.on("SIGINT", async () => {
  logger.info("[SIGINT] Arrêt gracieux…");
  await prisma.$disconnect();
  process.exit(0);
});
