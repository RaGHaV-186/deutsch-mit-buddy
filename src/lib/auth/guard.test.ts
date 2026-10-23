import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const getUser = vi.fn();
const getClaims = vi.fn();
const limitError = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, getClaims } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  limitError: (...a: unknown[]) => limitError(...a),
  clientIp: () => "1.1.1.1",
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { getAuthState, getClaimsState, requireAal2, requireAal2FromClaims, requireSession, withAuth } from "./guard";

const signedIn = (aal: string) => {
  getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.de" } }, error: null });
  getClaims.mockResolvedValue({ data: { claims: { aal, sub: "u1", email: "a@b.de" } } });
};

beforeEach(() => {
  vi.clearAllMocks();
  limitError.mockResolvedValue(undefined);
  getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
  getClaims.mockResolvedValue({ data: null, error: { message: "no session" } });
});

describe("getAuthState / requireAal2", () => {
  it("reports anonymous, aal1 and aal2", async () => {
    expect((await getAuthState()).status).toBe("anonymous");
    signedIn("aal1");
    expect((await getAuthState()).status).toBe("aal1");
    signedIn("aal2");
    expect(await getAuthState()).toEqual({ status: "aal2", userId: "u1", email: "a@b.de" });
  });
  it("redirects anonymous to login and aal1 to MFA", async () => {
    await expect(requireAal2()).rejects.toThrow("REDIRECT:/login");
    signedIn("aal1");
    await expect(requireAal2()).rejects.toThrow("REDIRECT:/mfa");
    signedIn("aal2");
    await expect(requireAal2()).resolves.toMatchObject({ userId: "u1" });
  });
});

describe("a session the auth server no longer accepts but whose token still looks valid (deleted user, revoked session)", () => {
  const staleToken = () => getClaims.mockResolvedValue({ data: { claims: { aal: "aal2", sub: "gone", email: "a@b.de" } }, error: null });
  it("requireAal2 and requireSession go through /auth/stale (which clears the cookies), not straight to /login", async () => {
    staleToken();
    await expect(requireAal2()).rejects.toThrow("REDIRECT:/auth/stale");
    await expect(requireSession()).rejects.toThrow("REDIRECT:/auth/stale");
  });
  it("without any token they still go to /login", async () => {
    await expect(requireAal2()).rejects.toThrow("REDIRECT:/login");
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("getClaimsState / requireAal2FromClaims (pages that only read)", () => {
  it("reads the level from the token's claims and never asks the auth server", async () => {
    expect((await getClaimsState()).status).toBe("anonymous");
    signedIn("aal1");
    expect((await getClaimsState()).status).toBe("aal1");
    signedIn("aal2");
    expect(await getClaimsState()).toEqual({ status: "aal2", userId: "u1", email: "a@b.de" });
    expect(getUser).not.toHaveBeenCalled();
  });
  it("still enforces two-factor: anonymous to login, aal1 to MFA", async () => {
    await expect(requireAal2FromClaims()).rejects.toThrow("REDIRECT:/login");
    signedIn("aal1");
    await expect(requireAal2FromClaims()).rejects.toThrow("REDIRECT:/mfa");
    signedIn("aal2");
    await expect(requireAal2FromClaims()).resolves.toMatchObject({ userId: "u1" });
  });
  it("treats a claim without a subject, or an error, as signed out", async () => {
    getClaims.mockResolvedValue({ data: { claims: { aal: "aal2" } }, error: null });
    expect((await getClaimsState()).status).toBe("anonymous");
  });
});

describe("withAuth", () => {
  const handler = vi.fn(async ({ input }: { input: { message: string } }) => Response.json({ got: input.message }));
  const route = withAuth({ name: "t", limit: 5, windowSeconds: 60, schema: z.object({ message: z.string().max(5) }) }, handler);
  const post = (body: unknown) =>
    route(new Request("http://x/api/t", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("answers 401 without a session and 403 without 2FA, without running the handler", async () => {
    expect((await post({ message: "hi" })).status).toBe(401);
    signedIn("aal1");
    const res = await post({ message: "hi" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "mfa_required" });
    expect(handler).not.toHaveBeenCalled();
  });
  it("makes exactly one rate-limit call, keyed by the user, and still verifies the session with the auth server", async () => {
    signedIn("aal2");
    await post({ message: "hi" });
    expect(limitError).toHaveBeenCalledTimes(1);
    expect(limitError).toHaveBeenCalledWith("user:t:u1", 5, 60);
    expect(getUser).toHaveBeenCalledTimes(1);
  });
  it("turns a token the auth server no longer accepts away with 401 even though its claims look valid", async () => {
    signedIn("aal2");
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "session revoked" } });
    expect((await post({ message: "hi" })).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
  it("does not touch the limiter or the auth server without a valid token", async () => {
    expect((await post({ message: "hi" })).status).toBe(401);
    expect(limitError).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
  it("answers 429 when really rate limited", async () => {
    signedIn("aal2");
    limitError.mockResolvedValue("rate_limited");
    const res = await post({ message: "hi" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect(handler).not.toHaveBeenCalled();
  });
  it("answers 503, not 429, when the limiter itself is unavailable", async () => {
    signedIn("aal2");
    limitError.mockResolvedValue("unavailable");
    const res = await post({ message: "hi" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(handler).not.toHaveBeenCalled();
  });
  it("validates JSON and input", async () => {
    signedIn("aal2");
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ message: "too long!" })).status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
  it("runs the handler for a valid AAL2 request", async () => {
    signedIn("aal2");
    const res = await post({ message: "hi" });
    expect(await res.json()).toEqual({ got: "hi" });
  });
});
