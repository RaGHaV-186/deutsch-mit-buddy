import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { limitError } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type AuthState =
  | { status: "anonymous" }
  | { status: "aal1"; userId: string; email: string | undefined }
  | { status: "aal2"; userId: string; email: string | undefined };

/** Verifies the session with the auth server (not just the cookie) and reads the assurance level. */
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };
  const { data: claimsData } = await supabase.auth.getClaims();
  const aal = claimsData?.claims?.aal;
  const base = { userId: data.user.id, email: data.user.email };
  return aal === "aal2" ? { status: "aal2", ...base } : { status: "aal1", ...base };
}

/**
 * Reads the session from the access token's claims. The token's signature is checked locally against the project's cached signing
 * keys, so there is no auth-server round trip (`getAuthState` below costs one). Same shape as `getAuthState`.
 * A session revoked on the server stays readable here until its token expires (at most an hour), which is fine for showing the
 * member's own rows (row-level security applies either way) and wrong for anything that changes data: pages that read use this,
 * server actions and API routes use `getAuthState` / `requireAal2`.
 */
export const getClaimsState = cache(async (): Promise<AuthState> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { status: "anonymous" };
  const base = { userId: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
  return claims.aal === "aal2" ? { status: "aal2", ...base } : { status: "aal1", ...base };
});

/** For pages that only read: signed in AND two-factor verified (from the token's claims), else redirect. */
export async function requireAal2FromClaims() {
  const state = await getClaimsState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "aal1") redirect("/mfa");
  return state;
}

/** For server actions and anything that changes data: signed in AND two-factor verified, checked with the auth server, else redirect. */
export async function requireAal2() {
  const state = await getAuthState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "aal1") redirect("/mfa");
  return state;
}

/** For pages and actions that need a session but not yet 2FA (the MFA screens). */
export async function requireSession() {
  const state = await getAuthState();
  if (state.status === "anonymous") redirect("/login");
  return state;
}

const limitResponse = (reason: "rate_limited" | "unavailable") =>
  NextResponse.json({ error: reason }, { status: reason === "rate_limited" ? 429 : 503 });

interface RouteOptions<T> {
  /** Name used in the rate-limit key, e.g. "feedback". */
  name: string;
  limit: number;
  windowSeconds: number;
  schema: ZodType<T>;
}

/**
 * Wraps a route handler: auth + AAL2 -> rate limit -> zod validation.
 * Every API route except the public health check uses this.
 *
 * The session is verified with the auth server (`getUser`). The rate limit is one call per request, keyed by the user from the
 * token's locally verified claims, and runs at the same time as that check, so the handler waits for one round trip, not three.
 * A request without a valid token never reaches the database (proxy.ts also turns those away).
 */
export function withAuth<T>(
  options: RouteOptions<T>,
  handler: (ctx: { userId: string; email: string | undefined; input: T; request: Request }) => Promise<Response>,
) {
  return async function route(request: Request): Promise<Response> {
    const claimed = await getClaimsState();
    if (claimed.status === "anonymous") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (claimed.status === "aal1") return NextResponse.json({ error: "mfa_required" }, { status: 403 });
    const [state, userBlocked] = await Promise.all([
      getAuthState(),
      limitError(`user:${options.name}:${claimed.userId}`, options.limit, options.windowSeconds),
    ]);
    if (state.status === "anonymous") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (state.status === "aal1") return NextResponse.json({ error: "mfa_required" }, { status: 403 });
    if (userBlocked) return limitResponse(userBlocked);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const parsed = options.schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return handler({ userId: state.userId, email: state.email, input: parsed.data, request });
  };
}
