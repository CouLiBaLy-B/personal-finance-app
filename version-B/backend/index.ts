import express from "express";
import cors from "cors";
import helmet from "helmet";
import { json } from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "express";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "./middleware/auth";
import { routes } from "./routes";

dotenv.config();

// Prisma client (singleton)
const prisma = new PrismaClient();

// Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? "*",
  credentials: true,
}));
app.use(json());
app.use(express.static(path.resolve(__dirname, "..", "public"), {
  maxAge: "1d",
}));

// Rate limiting (protect auth endpoints)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // limit each IP to 50 requests per minute
  message: "Trop de requêtes, réessayez dans une minute.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// API routes
app.use("/api", routes(prisma, limiter));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Handle 404
app.use((_req, _res, next) => {
  const err = new Error("Not Found");
  (err as any).status = 404;
  next(err);
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[ERROR]", err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

// Server listen
const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.info(`🚀 API server listening on port ${PORT}`);
});
