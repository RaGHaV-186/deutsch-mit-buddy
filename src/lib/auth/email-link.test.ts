import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();
const rateLimit = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  clientIp: () => "1.1.1.1",
}));

import { GET as confirm } from "@/app/auth/confirm/route";
import { GET as confirmRecovery } from "@/app/auth/confirm/recovery/route";

const call = (handler: typeof confirm, path: string) =>
  handler(new NextRequest(`http://localhost:3000${path}`));
const where = (res: Response) => {
  const u = new URL(res.headers.get("location")!);
  return u.pathname + u.search;
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue(true);
  exchangeCodeForSession.mockResolvedValue({ error: null });
  verifyOtp.mockResolvedValue({ error: null });
});

// Default Supabase templates ({{ .ConfirmationURL }}): Supabase verifies the link, then redirects with ?code=.
describe("default templates (?code=)", () => {
  it("confirms a sign-up: exchanges the code and continues to 2FA", async () => {
    const res = await call(confirm, "/auth/confirm?code=abc123");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(where(res)).toBe("/mfa");
  });

  it("password reset: exchanges the code and opens the new-password page", async () => {
    const res = await call(confirmRecovery, "/auth/confirm/recovery?code=abc123");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(where(res)).toBe("/reset-password");
  });

  it("explains what to do when the link is opened in another browser (no PKCE verifier)", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: "bad_code_verifier" } });
    expect(where(await call(confirm, "/auth/confirm?code=abc123"))).toBe("/login?error=link_device");
    expect(where(await call(confirmRecovery, "/auth/confirm/recovery?code=abc123"))).toBe("/login?error=link_device");
  });

  it("shows the expired-link message when Supabase reports an error", async () => {
    const res = await call(
      confirm,
      "/auth/confirm?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(where(res)).toBe("/login?error=link");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

// Our own templates (supabase/templates): token_hash works on any device.
describe("custom templates (?token_hash=&type=)", () => {
  it("verifies a sign-up link and continues to 2FA", async () => {
    const res = await call(confirm, "/auth/confirm?token_hash=h&type=email");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "h" });
    expect(where(res)).toBe("/mfa");
  });

  it("sends recovery links to the new-password page", async () => {
    const res = await call(confirmRecovery, "/auth/confirm/recovery?token_hash=h&type=recovery");
    expect(where(res)).toBe("/reset-password");
  });

  it("rejects bad or used tokens and unknown types", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    expect(where(await call(confirm, "/auth/confirm?token_hash=h&type=email"))).toBe("/login?error=link");
    expect(where(await call(confirm, "/auth/confirm?token_hash=h&type=bogus"))).toBe("/login?error=link");
  });
});

describe("guards", () => {
  it("sends links with nothing usable to the expired-link message", async () => {
    expect(where(await call(confirm, "/auth/confirm"))).toBe("/login?error=link");
  });

  it("is rate limited and does not touch Supabase when over the limit", async () => {
    rateLimit.mockResolvedValue(false);
    expect(where(await call(confirm, "/auth/confirm?code=abc"))).toBe("/login?error=rate_limited");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
