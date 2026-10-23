import { beforeEach, describe, expect, it, vi } from "vitest";

const limitError = vi.fn();
const listFactors = vi.fn();
const challengeAndVerify = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/auth/guard", () => ({ requireSession: async () => ({ userId: "u1" }) }));
vi.mock("@/lib/rate-limit", () => ({ limitError: (...a: unknown[]) => limitError(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { mfa: { listFactors, challengeAndVerify } } }) }));

import { enrollTotpAction, verifyEnrollAction, verifyLoginAction } from "./actions";

const codeForm = () => {
  const f = new FormData();
  f.set("code", "123456");
  f.set("factorId", "factor-1");
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  limitError.mockResolvedValue("rate_limited");
});

// Two-factor attempts are limited per signed-in user (the attacker already holds the session, so an IP limit would only punish shared
// networks), not per IP. Pinned here so a change to that is deliberate.
describe("two-factor actions are rate limited per user, before Supabase is asked", () => {
  it("starting setup", async () => {
    expect(await enrollTotpAction()).toEqual({ error: "rate_limited" });
    expect(limitError).toHaveBeenCalledWith("mfa-enroll:u1", 10, 600);
    expect(listFactors).not.toHaveBeenCalled();
  });
  it("confirming setup", async () => {
    expect(await verifyEnrollAction(undefined, codeForm())).toEqual({ error: "rate_limited" });
    expect(limitError).toHaveBeenCalledWith("mfa-verify:u1", 10, 600);
    expect(challengeAndVerify).not.toHaveBeenCalled();
  });
  it("checking a code at login", async () => {
    expect(await verifyLoginAction(undefined, codeForm())).toEqual({ error: "rate_limited" });
    expect(limitError).toHaveBeenCalledWith("mfa-verify:u1", 10, 600);
    expect(listFactors).not.toHaveBeenCalled();
  });
});
