import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isDefinitivelySignedOut } from "./stale-session";

describe("isDefinitivelySignedOut", () => {
  it("is true when the auth server says the user or session is gone", () => {
    expect(isDefinitivelySignedOut(new AuthApiError("User from sub claim in JWT does not exist", 403, "user_not_found"))).toBe(true);
    expect(isDefinitivelySignedOut(new AuthApiError("Session not found", 403, "session_not_found"))).toBe(true);
    expect(isDefinitivelySignedOut(new AuthApiError("invalid JWT", 401, "bad_jwt"))).toBe(true);
    expect(isDefinitivelySignedOut(new AuthSessionMissingError())).toBe(true);
  });
  it("is false for outages and anything else that says nothing about the session", () => {
    expect(isDefinitivelySignedOut(new AuthRetryableFetchError("fetch failed", 0))).toBe(false);
    expect(isDefinitivelySignedOut(new AuthApiError("boom", 500, "unexpected_failure"))).toBe(false);
    expect(isDefinitivelySignedOut(new AuthApiError("slow down", 429, "over_request_rate_limit"))).toBe(false);
    expect(isDefinitivelySignedOut(new Error("who knows"))).toBe(false);
    expect(isDefinitivelySignedOut(null)).toBe(false);
  });
});
