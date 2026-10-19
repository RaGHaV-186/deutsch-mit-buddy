/** Headers that don't depend on the request. next.config.ts applies them to every response. */
export const staticSecurityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
];

interface CspOptions {
  nonce: string;
  isDev?: boolean;
  supabaseUrl?: string;
}

/** Per-request Content-Security-Policy (the nonce changes on every request, so proxy.ts builds it). */
export function buildCsp({ nonce, isDev = false, supabaseUrl }: CspOptions): string {
  let supabaseHttp = "";
  let supabaseWs = "";
  if (supabaseUrl) {
    try {
      const u = new URL(supabaseUrl);
      supabaseHttp = u.origin;
      supabaseWs = `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}`;
    } catch {
      // A bad URL just means no Supabase origin in the policy.
    }
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "https://challenges.cloudflare.com",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Inline style attributes (React `style`, Next font CSS) need this; scripts stay locked down.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      supabaseHttp,
      supabaseWs,
      "https://*.ingest.de.sentry.io",
      "https://*.ingest.sentry.io",
      ...(isDev ? ["ws://localhost:*", "ws://127.0.0.1:*", "http://127.0.0.1:*"] : []),
    ].filter(Boolean),
    "frame-src": ["https://challenges.cloudflare.com"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
