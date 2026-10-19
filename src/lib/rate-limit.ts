import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

/**
 * ok: within the limit. limited: the caller really is over it. unavailable: we could not check
 * (database or service-role key problem). Fails closed, but callers must not tell members "too many tries" for that.
 */
export type RateLimitResult = "ok" | "limited" | "unavailable";

/** Fixed-window limit backed by Postgres: at most `limit` hits per `windowSeconds` for `key`. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true ? "ok" : "limited";
  } catch (err) {
    // Safe to log: error code/name and which settings exist, never keys, keys' values, the rate-limit key or user data.
    const e = err as { code?: string; name?: string; status?: number };
    console.error("rate limiter unavailable", {
      code: e?.code,
      name: e?.name,
      status: e?.status,
      supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      serviceRoleKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    return "unavailable";
  }
}

/** The error key (messages/en.json "Errors") to show when a request must stop, or undefined to carry on. */
export async function limitError(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<"rate_limited" | "unavailable" | undefined> {
  const result = await rateLimit(key, limit, windowSeconds);
  if (result === "ok") return undefined;
  return result === "limited" ? "rate_limited" : "unavailable";
}
