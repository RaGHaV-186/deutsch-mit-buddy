"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort error screen (outside the normal layout, so no i18n or theme here).
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <h1>Wuff! Something went wrong.</h1>
        <p>Please reload the page. Buddy has been told.</p>
      </body>
    </html>
  );
}
