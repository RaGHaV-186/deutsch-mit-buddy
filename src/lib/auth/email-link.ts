import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "magiclink", "email_change", "invite"];

/**
 * Lands the links in auth emails. Two shapes arrive here:
 *  - `?code=`: Supabase's DEFAULT templates ({{ .ConfirmationURL }}). Supabase verifies the link on its own server,
 *    then redirects here with a PKCE code that we exchange for a session. This needs the browser that requested
 *    the email (it holds the PKCE verifier cookie).
 *  - `?token_hash=&type=`: our own templates (supabase/templates), which work on any device.
 * `successPath` is where a good link leads; password-reset links always end at /reset-password.
 */
export async function handleEmailLink(request: NextRequest, successPath: string) {
  const { searchParams, origin } = request.nextUrl;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (!(await rateLimit(`confirm:${clientIp(request.headers)}`, 30, 600))) return go("/login?error=rate_limited");

  // Supabase reports expired or already-used links as ?error=...&error_code=otp_expired.
  if (searchParams.get("error") || searchParams.get("error_code")) return go("/login?error=link");

  const supabase = await createClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // Usually: the link was opened in a different browser than the one that asked for it.
    if (error) return go("/login?error=link_device");
    return go(successPath);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.includes(type)) return go("/login?error=link");
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return go("/login?error=link");
  return go(type === "recovery" ? "/reset-password" : successPath);
}
