/**
 * Sentry error tracking — optional, only activates if SENTRY_DSN is set.
 */
import * as Sentry from "@sentry/node";

const DSN = process.env.SENTRY_DSN;

export function initSentry(): void {
  if (!DSN) {
    console.info("ℹ️  Sentry: SENTRY_DSN not set, error tracking disabled.");
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV ?? "development",
    release: "fintrack@1.0.0",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });

  console.info("✅ Sentry: error tracking enabled.");
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!DSN) return;
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, val]) => {
        scope.setExtra(key, val);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export { Sentry };
