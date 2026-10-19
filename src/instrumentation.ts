import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Error reporting is off unless NEXT_PUBLIC_SENTRY_DSN is set (local dev, CI, previews without a DSN).
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}

export const onRequestError = Sentry.captureRequestError;
