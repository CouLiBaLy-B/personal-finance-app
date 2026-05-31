import winston from "winston";
import expressWinston from "express-winston";

/**
 * Logger Winston structuré — utilisé à la fois pour les logs applicatifs
 * et les requêtes HTTP (express-winston). Niveau configurable en variable
 * d'environnement LOG_LEVEL (debug | info | warn | error).
 */

const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // En production, on peut aussi écrire dans un fichier rotatif.
    process.env.NODE_ENV === "production"
      ? new winston.transports.File({
          filename: "./logs/app.log",
          maxsize: 10 * 1024 * 1024, // 10 Mo
          maxFiles: 5,
        })
      : null,
  ].filter((t) => t !== null),
});

// Middleware Express : log toutes les requêtes
export const httpLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
  expressFormat: false,
  colorize: true,
});

// Middleware Express : log les erreurs 5xx
export const httpErrorLogger = expressWinston.errorLogger({
  winstonInstance: logger,
  meta: true,
});

logger.info(`[Logger] initialisé — niveau=${LOG_LEVEL}, env=${process.env.NODE_ENV ?? "dev"}`);
