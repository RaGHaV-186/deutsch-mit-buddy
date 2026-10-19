import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

/** Fixed-window limit backed by Postgres. Returns true while `key` is within `limit` hits per window. Fails closed. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("rate limit check failed", err instanceof Error ? err.message : err);
    return false;
  }
}
