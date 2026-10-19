import { NextResponse, type NextRequest } from "next/server";
import { decideRoute } from "@/lib/auth/route-policy";
import { buildCsp } from "@/lib/security-headers";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const { response, claims } = await updateSession(request, requestHeaders);
  const decision = decideRoute(request.nextUrl.pathname, claims, request.nextUrl.search);

  let out = response;
  if (decision.type === "redirect") {
    out = NextResponse.redirect(new URL(decision.to, request.url));
    // Keep any refreshed session cookies on the redirect.
    response.cookies.getAll().forEach((c) => out.cookies.set(c));
  } else if (decision.type === "json") {
    out = NextResponse.json({ error: decision.error }, { status: decision.status });
    response.cookies.getAll().forEach((c) => out.cookies.set(c));
  }
  out.headers.set("Content-Security-Policy", csp);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export const config = {
  matcher: [
    // Everything except static assets and the PWA manifest.
    "/((?!_next/static|_next/image|favicon.ico|buddy/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)",
  ],
};
