/**
 * Winston logger + express-winston integration.
 */
import winston from "winston";
import expressWinston from "express-winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack }) =>
    `${timestamp} ${level}: ${stack ?? message}`
  )
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});

export const httpLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: false,
  msg: "{{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
  colorize: process.env.NODE_ENV !== "production",
});
