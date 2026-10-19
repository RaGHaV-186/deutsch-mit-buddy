import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

beforeEach(() => vi.stubEnv("TURNSTILE_SECRET_KEY", "secret"));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("verifyTurnstile", () => {
  it("accepts a token Cloudflare approves, sending secret and IP", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ success: true }));
    expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(true);
    const body = (f.mock.calls[0][1]?.body as URLSearchParams).toString();
    expect(body).toContain("secret=secret");
    expect(body).toContain("remoteip=1.2.3.4");
  });
  it("rejects failures, missing tokens, missing secret and network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ success: false }));
    expect(await verifyTurnstile("tok")).toBe(false);
    expect(await verifyTurnstile(undefined)).toBe(false);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("x"));
    expect(await verifyTurnstile("tok")).toBe(false);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(await verifyTurnstile("tok")).toBe(false);
  });
});
