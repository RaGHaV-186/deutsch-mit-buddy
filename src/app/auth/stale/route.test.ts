import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();
const limitError = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims, getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { signOut } }) }));
vi.mock("@/lib/rate-limit", () => ({ limitError: (...a: unknown[]) => limitError(...a), clientIp: () => "203.0.113.9" }));

import { GET } from "./route";

const call = (cookies = "sb-x-auth-token=abc; sb-x-auth-token-code-verifier=v; theme=dark") =>
  GET(new NextRequest("https://www.example.de/auth/stale", { headers: { cookie: cookies } }));
const where = (res: Response) => new URL(res.headers.get("location") ?? "http://none").pathname;
const cleared = (res: Response) =>
  res.headers.getSetCookie().filter((c) => /Max-Age=0/i.test(c)).map((c) => c.split("=")[0]).sort();

const token = (aal = "aal2") => getClaims.mockResolvedValue({ data: { claims: { sub: "u1", aal } }, error: null });
const userOk = () => getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
const userGone = (status = 403, code = "user_not_found") =>
  getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError("gone", status, code) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  limitError.mockResolvedValue(undefined);
  signOut.mockResolvedValue({ error: null });
  getClaims.mockResolvedValue({ data: null, error: { message: "no session" } });
  maybeSingle.mockResolvedValue({ data: { user_id: "u1" }, error: null });
});

describe("GET /auth/stale", () => {
  it("a deleted user with a valid-looking token: signs out, clears the auth cookies (only those) and lands on /login once", async () => {
    token();
    userGone();
    const res = await call();
    expect(where(res)).toBe("/login");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(cleared(res)).toEqual(["sb-x-auth-token", "sb-x-auth-token-code-verifier"]);
  });

  it("a revoked session behaves the same", async () => {
    token();
    userGone(403, "session_not_found");
    expect(where(await call())).toBe("/login");
    expect(signOut).toHaveBeenCalled();
  });

  it("a user whose profile row is missing is signed out too", async () => {
    token();
    userOk();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await call();
    expect(where(res)).toBe("/login");
    expect(signOut).toHaveBeenCalled();
    expect(cleared(res)).toContain("sb-x-auth-token");
  });

  it("a healthy session is never signed out (a link to this route cannot log anyone out): back to /home", async () => {
    token();
    userOk();
    const res = await call();
    expect(where(res)).toBe("/home");
    expect(signOut).not.toHaveBeenCalled();
    expect(cleared(res)).toEqual([]);
  });

  it("a healthy session that has not done two-factor goes to /mfa, untouched", async () => {
    token("aal1");
    userOk();
    expect(where(await call())).toBe("/mfa");
    expect(signOut).not.toHaveBeenCalled();
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("no token at all: straight to /login, nothing to clear and no auth-server call", async () => {
    const res = await call("");
    expect(where(res)).toBe("/login");
    expect(getUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("an auth-server outage or a database error answers 503 and leaves the session alone", async () => {
    token();
    getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("fetch failed", 0) });
    let res = await call();
    expect(res.status).toBe(503);
    expect(signOut).not.toHaveBeenCalled();
    expect(cleared(res)).toEqual([]);

    userOk();
    maybeSingle.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    res = await call();
    expect(res.status).toBe(503);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("is rate limited per IP (so a flapping error cannot become an endless loop)", async () => {
    limitError.mockResolvedValue("rate_limited");
    token();
    expect((await call()).status).toBe(429);
    expect(limitError).toHaveBeenCalledWith("stale:203.0.113.9", 30, 600);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("still lands on /login when signing out on the server fails", async () => {
    token();
    userGone();
    signOut.mockRejectedValue(new Error("network"));
    const res = await call();
    expect(where(res)).toBe("/login");
    expect(cleared(res)).toContain("sb-x-auth-token");
  });
});
