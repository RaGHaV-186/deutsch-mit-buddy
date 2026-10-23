import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDefinitivelySignedOut } from "@/lib/auth/stale-session";
import { clientIp, limitError } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends a session the app can no longer use: a token that still looks valid (so the proxy keeps sending /login to /home) but whose
 * user or profile is gone, or whose session was revoked. Screens and guards redirect here instead of to /login; this route checks
 * for itself, signs out, clears the auth cookies and sends the browser to /login once, so there is no redirect loop.
 *
 * It never signs out a healthy session (a link to it cannot be used to log someone out), and never on a guess: when the auth
 * server or the database cannot be reached it answers 503 and leaves the cookies alone.
 */
export async function GET(request: NextRequest) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));
  const unavailable = () => new NextResponse("Please try again in a minute.", { status: 503, headers: { "Cache-Control": "no-store" } });

  const blocked = await limitError(`stale:${clientIp(request.headers)}`, 30, 600);
  if (blocked) return blocked === "rate_limited" ? new NextResponse("Too many tries.", { status: 429 }) : unavailable();

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  // Nothing to clear: the proxy already treats this browser as signed out.
  if (!claims?.sub) return go("/login");

  const { data: userData, error: userError } = await supabase.auth.getUser();
  let stale = false;
  if (userError) {
    if (!isDefinitivelySignedOut(userError)) return unavailable();
    stale = true;
  } else if (!userData.user) {
    stale = true;
  } else if (claims.aal !== "aal2") {
    // A real session that has not done two-factor yet: not ours to end.
    return go("/mfa");
  } else {
    const { data: profile, error } = await supabase.from("profiles").select("user_id").eq("user_id", claims.sub).maybeSingle();
    if (error) return unavailable();
    stale = !profile;
  }
  if (!stale) return go("/home");

  // End the session on the server too, with a client that writes no cookies of its own: the clearing below is the only thing that
  // touches them, so nothing else in this response can put an auth cookie back.
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const detached = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } });
      await detached.auth.signOut({ scope: "local" });
    }
  } catch {
    // Best effort: the cookies are cleared below either way.
  }
  const response = go("/login");
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith("sb-")) {
      response.cookies.set(name, "", { path: "/", maxAge: 0, expires: new Date(0), httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    }
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
