import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
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

/** For pages and server actions: signed in AND two-factor verified, else redirect. */
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

interface RouteOptions<T> {
  /** Name used in the rate-limit key, e.g. "feedback". */
  name: string;
  limit: number;
  windowSeconds: number;
  schema: ZodType<T>;
}

/**
 * Wraps a route handler: rate limit (per IP, then per user) -> auth + AAL2 -> zod validation.
 * Every API route except the public health check uses this.
 */
export function withAuth<T>(
  options: RouteOptions<T>,
  handler: (ctx: { userId: string; email: string | undefined; input: T; request: Request }) => Promise<Response>,
) {
  return async function route(request: Request): Promise<Response> {
    const ip = clientIp(request.headers);
    if (!(await rateLimit(`ip:${options.name}:${ip}`, options.limit * 3, options.windowSeconds))) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const state = await getAuthState();
    if (state.status === "anonymous") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (state.status === "aal1") return NextResponse.json({ error: "mfa_required" }, { status: 403 });
    if (!(await rateLimit(`user:${options.name}:${state.userId}`, options.limit, options.windowSeconds))) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
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
