import "server-only";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Server-side Turnstile check (used where we don't go through Supabase's own CAPTCHA, e.g. the waitlist). Fails closed. */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
