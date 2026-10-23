import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";
import { staticSecurityHeaders } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Dynamic screens are not cached on the client (dynamic: 0), so they always show current data. A full prefetch of a tab (the tab bar and
    // sidebar ask for one) is kept only briefly, long enough for the tap that follows; the default 5 minutes would show stale due counts.
    staleTimes: { dynamic: 0, static: 20 },
  },
  async headers() {
    return [
      { source: "/:path*", headers: staticSecurityHeaders },
      // The worker file must always be re-checked, or a bad version could stick on phones.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  // Source maps are uploaded only when a token is present (Vercel production builds).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
