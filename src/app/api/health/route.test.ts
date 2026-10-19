import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const configured = () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
};

describe("GET /api/health", () => {
  it("reports not-configured without Supabase env", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const body = await (await GET()).json();
    expect(body).toMatchObject({ app: "ok", supabase: "not-configured" });
  });

  it("reports ok when Supabase and the rate limiter table answer", async () => {
    configured();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const body = await (await GET()).json();
    expect(body).toMatchObject({ app: "ok", supabase: "ok", rateLimiter: "ok", config: { serviceRoleKey: "set" } });
  });

  it("flags a missing service-role key, which would stop every sign-up", async () => {
    configured();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const body = await (await GET()).json();
    expect(body).toMatchObject({ rateLimiter: "not-configured", config: { serviceRoleKey: "missing" } });
  });

  it("flags a service-role key Supabase rejects", async () => {
    configured();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "wrong");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (u: string) => ({ ok: !String(u).includes("rate_limits") })),
    );
    const body = await (await GET()).json();
    expect(body).toMatchObject({ supabase: "ok", rateLimiter: "unavailable" });
  });

  it("reports unreachable when the request fails, and never leaks keys", async () => {
    configured();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-service-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await GET();
    const text = JSON.stringify(await res.json());
    expect(text).toContain('"supabase":"unreachable"');
    expect(text).not.toContain("secret-service-key");
    expect(text).not.toContain("example.supabase.co");
  });
});
