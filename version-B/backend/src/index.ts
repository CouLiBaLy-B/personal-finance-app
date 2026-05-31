// ===========================================
// FinTrack Backend - Main Entry Point
// ===========================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import passport from "passport";

// Import middleware
import { requestLogger, errorLogger } from "./utils/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { defaultLimiter } from "./middleware/rateLimiter";
import { authenticateJWT } from "./middleware/auth";

// Import routes
import routes from "./routes/index";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// ===========================================
// Security Middleware
// ===========================================

// Helmet for security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_ORIGIN?.split(",") || "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Session-ID"],
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ===========================================
// Passport Initialization
// ===========================================

app.use(passport.initialize());

// ===========================================
// Request Logging
// ===========================================

if (process.env.NODE_ENV !== "test") {
  app.use(requestLogger);
}

// ===========================================
// Rate Limiting
// ===========================================

app.use(defaultLimiter);

// ===========================================
// API Routes
// ===========================================

// Mount all routes under /api/v1
app.use("/api/v1", routes);

// ===========================================
// Static Files
// ===========================================

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ===========================================
// Error Handling
// ===========================================

// 404 handler
app.use(notFoundHandler);

// Error logger (must be before error handler)
if (process.env.NODE_ENV !== "test") {
  app.use(errorLogger);
}

// Global error handler
app.use(errorHandler);

// ===========================================
// Server Initialization
// ===========================================

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`🚀 FinTrack API server running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/api/v1/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  console.error("Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught Exception:", err);
  server.close(() => process.exit(1));
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

export default app;
