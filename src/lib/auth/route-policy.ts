import { safeNextPath } from "./next-path";

export interface SessionClaims {
  sub: string;
  aal?: string;
}

export type RouteDecision =
  | { type: "next" }
  | { type: "redirect"; to: string }
  | { type: "json"; status: 401 | 403; error: "unauthenticated" | "mfa_required" };

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/waitlist",
  "/check-email",
  "/impressum",
  "/datenschutz",
  "/terms",
  // The offline shell (public, no account data): the service worker sends the browser here when an app screen cannot be reached.
  "/offline",
  "/api/health",
]);
// Signed-out visitors only; signed-in (AAL2) members are sent to the app.
const GUEST_ONLY = new Set(["/login", "/signup", "/forgot-password"]);
// Needs a session, but not yet two-factor (that is how members get to AAL2).
const SESSION_ONLY_EXACT = new Set(["/mfa", "/reset-password"]);

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * The one rule for who may open what. Everything not listed needs a session at AAL2.
 * Runs in proxy.ts on JWT claims only (no network); pages that only read re-check the same claims (requireAal2FromClaims()); actions and API routes re-check with the auth server (requireAal2(), withAuth).
 */
export function decideRoute(rawPath: string, claims: SessionClaims | null, search = ""): RouteDecision {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  const isApi = isUnder(path, "/api");
  const aal2 = claims?.aal === "aal2";

  if (PUBLIC_EXACT.has(path) || isUnder(path, "/auth")) {
    if (GUEST_ONLY.has(path) && aal2) return { type: "redirect", to: "/home" };
    return { type: "next" };
  }

  if (!claims) {
    if (isApi) return { type: "json", status: 401, error: "unauthenticated" };
    const next = safeNextPath(`${path}${search}`, "");
    return { type: "redirect", to: next ? `/login?next=${encodeURIComponent(next)}` : "/login" };
  }

  if (SESSION_ONLY_EXACT.has(path) || isUnder(path, "/mfa")) return { type: "next" };

  if (!aal2) {
    if (isApi) return { type: "json", status: 403, error: "mfa_required" };
    return { type: "redirect", to: "/mfa" };
  }
  return { type: "next" };
}
