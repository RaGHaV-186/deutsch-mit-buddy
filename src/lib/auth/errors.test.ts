import { describe, expect, it } from "vitest";
import { authErrorKey, isMemberCapError } from "./errors";

describe("auth error mapping", () => {
  it("maps known codes and falls back to generic", () => {
    expect(authErrorKey({ code: "captcha_failed" })).toBe("captcha");
    expect(authErrorKey({ code: "invalid_credentials" })).toBe("invalid_credentials");
    expect(authErrorKey({ code: "over_email_send_rate_limit" })).toBe("rate_limited");
    expect(authErrorKey({ code: "something_new" })).toBe("generic");
    expect(authErrorKey(null)).toBe("generic");
  });
  it("recognises the cap trigger failure", () => {
    expect(isMemberCapError({ message: "Database error saving new user" })).toBe(true);
    expect(isMemberCapError({ message: "User already registered" })).toBe(false);
  });
});
