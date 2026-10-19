import { NextResponse } from "next/server";

const set = (name: string) => (process.env[name] ? "set" : "missing");

// Public liveness check. Reports whether Supabase answers and whether the server-side settings the sign-up
// flow needs are present and working. Only "ok"/"set"/"missing" words: never keys, URLs or error details.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const config = {
    serviceRoleKey: set("SUPABASE_SERVICE_ROLE_KEY"),
    turnstileSiteKey: set("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    turnstileSecret: set("TURNSTILE_SECRET_KEY"),
    siteUrl: set("NEXT_PUBLIC_SITE_URL"),
  };
  if (!url || !key) {
    return NextResponse.json({ app: "ok", supabase: "not-configured", config });
  }

  const get = async (path: string, apiKey: string) => {
    try {
      const res = await fetch(`${url}${path}`, {
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const supabase = (await get("/auth/v1/health", key)) ? "ok" : "unreachable";
  // Can the server really use the rate limiter table with the service-role key?
  const rateLimiter = !serviceKey
    ? "not-configured"
    : (await get("/rest/v1/rate_limits?select=key&limit=1", serviceKey))
      ? "ok"
      : "unavailable";
  return NextResponse.json({ app: "ok", supabase, rateLimiter, config });
}
