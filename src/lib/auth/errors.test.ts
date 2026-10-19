import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { authErrorKey, ERROR_KEYS, isMemberCapError, logAuthError } from "./errors";

describe("authErrorKey", () => {
  it.each([
    [{ code: "captcha_failed", status: 400 }, "captcha"],
    [{ code: "invalid_credentials", status: 400 }, "invalid_credentials"],
    [{ code: "email_not_confirmed", status: 400 }, "email_not_confirmed"],
    [{ code: "weak_password", status: 422 }, "weak_password"],
    [{ code: "validation_failed", status: 400 }, "invalid_input"],
    [{ code: "email_address_invalid", status: 400 }, "invalid_input"],
    // Supabase's own limits get different messages, so members aren't told "too many tries" for an email quota.
    [{ code: "over_request_rate_limit", status: 429 }, "rate_limited"],
    [{ code: "over_email_send_rate_limit", status: 429 }, "email_rate_limit"],
    [{ code: "email_address_not_authorized", status: 400 }, "email_not_authorized"],
    [{ code: "mfa_verification_failed", status: 400 }, "invalid_code"],
  ])("maps %j to %s", (error, key) => {
    expect(authErrorKey(error)).toBe(key);
  });

  it("calls network failures and Supabase 5xx 'unavailable', not 'too many tries'", () => {
    expect(authErrorKey({ name: "AuthRetryableFetchError", status: 0 })).toBe("unavailable");
    expect(authErrorKey({ code: "unexpected_failure", status: 500 })).toBe("unavailable");
    expect(authErrorKey({ status: 502 })).toBe("unavailable");
  });

  it("falls back to generic for anything unknown", () => {
    expect(authErrorKey({ code: "something_new", status: 400 })).toBe("generic");
    expect(authErrorKey(null)).toBe("generic");
  });

  it("never maps a non-rate-limit error to the rate-limit message", () => {
    for (const code of ["captcha_failed", "unexpected_failure", "email_address_not_authorized", "over_email_send_rate_limit"]) {
      expect(authErrorKey({ code, status: 500 })).not.toBe("rate_limited");
    }
  });
});

describe("error messages", () => {
  const messages = JSON.parse(readFileSync("messages/en.json", "utf8")).Errors as Record<string, string>;
  it("has a message for every error key, and no unused ones", () => {
    expect(Object.keys(messages).sort()).toEqual([...ERROR_KEYS].sort());
  });
  it("gives each case its own wording", () => {
    const texts = ERROR_KEYS.map((k) => messages[k]);
    expect(new Set(texts).size).toBe(texts.length);
    expect(messages.rate_limited).toMatch(/too many tries/i);
    for (const k of ["captcha", "email_rate_limit", "email_not_authorized", "unavailable"]) {
      expect(messages[k]).not.toMatch(/too many tries/i);
    }
  });
});

describe("isMemberCapError", () => {
  it("recognises the cap trigger's database error", () => {
    expect(isMemberCapError({ message: "Database error saving new user" })).toBe(true);
    expect(isMemberCapError({ message: "User already registered" })).toBe(false);
  });
});

describe("logAuthError", () => {
  it("logs only code, name and status", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logAuthError("signUp", { code: "captcha_failed", status: 400, name: "AuthApiError", message: "for tester@example.com" });
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain("captcha_failed");
    expect(logged).not.toContain("tester@example.com");
    spy.mockRestore();
  });
});
