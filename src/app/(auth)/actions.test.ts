import { beforeEach, describe, expect, it, vi } from "vitest";

const limitError = vi.fn();
const signUp = vi.fn();
const rpc = vi.fn();
const isPasswordPwned = vi.fn();

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  limitError: (...a: unknown[]) => limitError(...a),
  clientIp: () => "203.0.113.9",
}));
vi.mock("@/lib/hibp", () => ({ isPasswordPwned: (...a: unknown[]) => isPasswordPwned(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signUp }, rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("@/lib/auth/guard", () => ({ requireSession: async () => ({ userId: "u1" }) }));

import { forgotPasswordAction, googleSignInAction, joinWaitlistAction, signInAction, signUpAction } from "./actions";

const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const base = { email: "anna@example.com", password: "Quiet-Dog-Walks-71", terms: "on", "cf-turnstile-response": "tok" };
  for (const [k, v] of Object.entries({ ...base, ...over })) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  limitError.mockResolvedValue(undefined);
  isPasswordPwned.mockResolvedValue(false);
  rpc.mockResolvedValue({ data: true });
  signUp.mockResolvedValue({ error: null });
});

describe("signUpAction: which message each failure shows", () => {
  it("really rate limited -> 'rate_limited', and Supabase is never called", async () => {
    limitError.mockResolvedValue("rate_limited");
    expect(await signUpAction(undefined, form())).toEqual({ error: "rate_limited" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("limiter broken (missing key, DB problem) -> 'unavailable', NOT 'too many tries'", async () => {
    limitError.mockResolvedValue("unavailable");
    expect(await signUpAction(undefined, form())).toEqual({ error: "unavailable" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("passes the Turnstile token to Supabase", async () => {
    await expect(signUpAction(undefined, form())).rejects.toThrow("REDIRECT:/check-email?type=confirm");
    expect(signUp.mock.calls[0][0].options.captchaToken).toBe("tok");
  });

  it.each([
    ["captcha_failed", 400, "captcha"],
    ["over_request_rate_limit", 429, "rate_limited"],
    ["over_email_send_rate_limit", 429, "email_rate_limit"],
    ["email_address_not_authorized", 400, "email_not_authorized"],
    ["weak_password", 422, "weak_password"],
    ["validation_failed", 400, "invalid_input"],
    ["unexpected_failure", 500, "unavailable"],
    ["something_new", 400, "generic"],
  ])("Supabase error %s (%i) -> %s", async (code, status, expected) => {
    signUp.mockResolvedValue({ error: { code, status, name: "AuthApiError", message: "x" } });
    expect(await signUpAction(undefined, form())).toEqual({ error: expected });
  });

  it("logs the real Supabase error code, without the email or password", async () => {
    signUp.mockResolvedValue({ error: { code: "captcha_failed", status: 400, name: "AuthApiError", message: "anna@example.com" } });
    await signUpAction(undefined, form());
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("captcha_failed");
    expect(logged).not.toContain("anna@example.com");
    expect(logged).not.toContain("Quiet-Dog-Walks-71");
  });

  it("database error while the cap is reached -> waitlist", async () => {
    signUp.mockResolvedValue({ error: { code: "unexpected_failure", status: 500, message: "Database error saving new user" } });
    rpc.mockResolvedValue({ data: false });
    await expect(signUpAction(undefined, form())).rejects.toThrow("REDIRECT:/waitlist?full=1");
  });

  it("database error while seats are free is NOT sent to the waitlist", async () => {
    signUp.mockResolvedValue({ error: { code: "unexpected_failure", status: 500, message: "Database error saving new user" } });
    rpc.mockResolvedValue({ data: true });
    expect(await signUpAction(undefined, form())).toEqual({ error: "unavailable" });
  });

  it("cap already reached before trying -> waitlist", async () => {
    rpc.mockResolvedValue({ data: false });
    await expect(signUpAction(undefined, form())).rejects.toThrow("REDIRECT:/waitlist?full=1");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("leaked password and missing terms get their own messages", async () => {
    isPasswordPwned.mockResolvedValue(true);
    expect(await signUpAction(undefined, form())).toEqual({ error: "pwned" });
    expect(await signUpAction(undefined, form({ terms: "" }))).toEqual({ error: "terms_required" });
  });
});

describe("every public auth action is limited per IP, before anything else is asked of Supabase", () => {
  const withCaptcha = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ "cf-turnstile-response": "tok", ...fields })) f.set(k, v);
    return f;
  };
  const cases: [string, () => Promise<unknown>, string, number, number][] = [
    ["sign up", () => signUpAction(undefined, form()), "signup:203.0.113.9", 10, 3600],
    ["log in", () => signInAction(undefined, withCaptcha({ email: "anna@example.com", password: "Quiet-Dog-Walks-71" })), "login:203.0.113.9", 20, 600],
    ["Google sign-in", () => googleSignInAction(), "oauth:203.0.113.9", 20, 600],
    ["password reset request", () => forgotPasswordAction(undefined, withCaptcha({ email: "anna@example.com" })), "reset:203.0.113.9", 5, 3600],
    ["waitlist", () => joinWaitlistAction(undefined, withCaptcha({ email: "anna@example.com" })), "waitlist:203.0.113.9", 5, 3600],
  ];
  it.each(cases)("%s: key %s", async (_name, run, key, limit, window) => {
    limitError.mockResolvedValue("rate_limited");
    expect(await run()).toEqual({ error: "rate_limited" });
    expect(limitError).toHaveBeenCalledTimes(1);
    expect(limitError).toHaveBeenCalledWith(key, limit, window);
    expect(signUp).not.toHaveBeenCalled();
  });
});
