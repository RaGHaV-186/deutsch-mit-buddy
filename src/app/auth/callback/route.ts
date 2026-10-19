import { NextResponse, type NextRequest } from "next/server";
import { isMemberCapError } from "@/lib/auth/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Google (OAuth) lands here with ?code=. Exchange it for a session, then let /mfa decide setup vs verify.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (!(await rateLimit(`callback:${clientIp(request.headers)}`, 30, 600))) return fail("/login?error=rate_limited");

  const oauthError = searchParams.get("error_description");
  if (oauthError) {
    return fail(isMemberCapError({ message: oauthError }) ? "/waitlist?full=1" : "/login?error=oauth");
  }
  const code = searchParams.get("code");
  if (!code) return fail("/login?error=oauth");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("/login?error=oauth");
  return fail("/mfa");
}
