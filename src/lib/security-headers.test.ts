import { describe, expect, it } from "vitest";
import { buildCsp, staticSecurityHeaders } from "./security-headers";

describe("buildCsp", () => {
  const csp = buildCsp({ nonce: "abc123", supabaseUrl: "https://proj.supabase.co" });
  const directive = (name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

  it("allows scripts only with the nonce, plus Turnstile", () => {
    expect(directive("script-src")).toContain("'nonce-abc123'");
    expect(directive("script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
    expect(directive("script-src")).not.toContain("'unsafe-eval'");
  });
  it("forbids framing and plugins, and limits where we talk to", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("connect-src")).toContain("https://proj.supabase.co");
    expect(directive("connect-src")).toContain("wss://proj.supabase.co");
    expect(directive("img-src")).toContain("data:");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("only relaxes for dev", () => {
    const dev = buildCsp({ nonce: "x", isDev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
  it("sets HSTS and friends statically", () => {
    const keys = staticSecurityHeaders.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options"]));
  });
});
