import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SessionClaims } from "@/lib/auth/route-policy";
import { hardenCookie } from "./cookies";

/**
 * Refreshes the session cookies and reads the (locally verified) JWT claims. No database or auth-server
 * round trip for normal requests. `requestHeaders` carries the CSP nonce through to rendering.
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!url || !key) return { response, claims: null as SessionClaims | null };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
        response = NextResponse.next({ request: { headers: requestHeaders } });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, hardenCookie(options)));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = !error && data?.claims?.sub ? (data.claims as SessionClaims) : null;
  return { response, claims };
}
