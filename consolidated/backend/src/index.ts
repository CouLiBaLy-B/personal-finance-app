/**
 * FinTrack Backend — Consolidated Entry Point.
 */
import "dotenv/config";
import { initSentry, Sentry } from "./lib/sentry.js";
initSentry(); // Must be first!

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { ensureJwtSecret } from "./lib/jwt.js";
import { httpLogger, logger } from "./utils/logger.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import apiRouter from "./routes/index.js";
import fs from "fs";

// ============ Startup checks ============
ensureJwtSecret();

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ============ Express app ============
const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Security
app.use(helmet());

// CORS — restricted origins
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// Rate limiting
app.use(globalLimiter);

// Cookie & body parsing
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(httpLogger);

// ============ Health check ============
app.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    const { prisma } = await import("./lib/prisma.js");
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {}

  const mem = process.memoryUsage();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    version: "1.0.0-consolidated",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: dbOk ? "connected" : "unreachable",
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + "MB",
    },
  });
});

// ============ Swagger / OpenAPI ============
if (process.env.NODE_ENV !== "production") {
  import("swagger-ui-express").then((swaggerUi) => {
    import("fs").then((fsm) => {
      import("yaml").then((yaml) => {
        try {
          const doc = yaml.parse(fsm.readFileSync("openapi.yaml", "utf-8"));
          app.use("/docs", swaggerUi.serve, swaggerUi.setup(doc, { customSiteTitle: "FinTrack API" }));
          logger.info("📚 Swagger UI: http://localhost:" + PORT + "/docs");
        } catch {}
      });
    });
  });
}

// ============ API Routes ============
app.use("/api/v1", apiRouter);

// ============ Sentry error handler (before our custom one) ============
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ============ Error handler (must be last) ============
app.use(errorHandler);

// ============ Start ============
app.listen(PORT, () => {
  logger.info(`🚀 FinTrack API running on http://localhost:${PORT}`);
  logger.info(`📄 Health check: http://localhost:${PORT}/health`);
  logger.info(`📡 API base: http://localhost:${PORT}/api/v1`);
  logger.info(`🔐 CORS origins: ${allowedOrigins.join(", ")}`);
});

export default app;
