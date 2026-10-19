import { afterEach, describe, expect, it, vi } from "vitest";
import { feedbackSchema, mfaCodeSchema, signInSchema, signUpSchema, waitlistSchema } from "./auth";

const good = { email: "  Anna@Example.com ", password: "correct-horse-battery", terms: "on", captchaToken: "tok" };

afterEach(() => vi.unstubAllEnvs());

describe("auth schemas", () => {
  it("normalises the email and accepts a valid sign-up", () => {
    const r = signUpSchema.parse(good);
    expect(r.email).toBe("anna@example.com");
  });
  it("rejects short passwords and missing terms", () => {
    expect(signUpSchema.safeParse({ ...good, password: "short" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...good, terms: undefined }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...good, email: "nope" }).success).toBe(false);
  });
  it("requires a captcha token only when Turnstile is configured", () => {
    expect(signUpSchema.safeParse({ ...good, captchaToken: "" }).success).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    expect(signUpSchema.safeParse({ ...good, captchaToken: "" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...good, captchaToken: undefined }).success).toBe(false);
    expect(signUpSchema.safeParse(good).success).toBe(true);
  });
  it("caps lengths", () => {
    expect(signUpSchema.safeParse({ ...good, password: "x".repeat(129) }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...good, displayName: "x".repeat(41) }).success).toBe(false);
    expect(waitlistSchema.safeParse({ email: `${"a".repeat(250)}@b.de`, captchaToken: "t" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
    expect(feedbackSchema.safeParse({ message: "   " }).success).toBe(false);
  });
  it("sign-in does not enforce the new-password length", () => {
    expect(signInSchema.safeParse({ email: "a@b.de", password: "old", captchaToken: "t" }).success).toBe(true);
  });
  it("accepts exactly six digits for 2FA", () => {
    expect(mfaCodeSchema.safeParse("123456").success).toBe(true);
    for (const bad of ["12345", "1234567", "12345a", ""]) expect(mfaCodeSchema.safeParse(bad).success).toBe(false);
  });
});
