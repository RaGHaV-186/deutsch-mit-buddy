import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

import { clientIp, limitError, rateLimit } from "./rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  createAdminClient.mockReturnValue({ rpc });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("rateLimit", () => {
  it("says ok while the database allows and limited when the caller is over", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await rateLimit("k", 5, 60)).toBe("ok");
    expect(rpc).toHaveBeenCalledWith("hit_rate_limit", { p_key: "k", p_limit: 5, p_window_seconds: 60 });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await rateLimit("k", 5, 60)).toBe("limited");
  });

  it("says unavailable (not limited) when the database call fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42883", message: "function does not exist" } });
    expect(await rateLimit("k", 5, 60)).toBe("unavailable");
  });

  it("says unavailable when the service-role key is missing", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("Supabase service role is not configured");
    });
    expect(await rateLimit("k", 5, 60)).toBe("unavailable");
  });

  it("logs the cause without secrets, keys or personal data", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "super-secret-key");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST301", name: "PostgrestError", status: 401 } });
    await rateLimit("signup:203.0.113.9", 5, 60);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("PGRST301");
    expect(logged).toContain('"serviceRoleKeySet":true');
    expect(logged).not.toContain("super-secret-key");
    expect(logged).not.toContain("203.0.113.9");
  });
});

describe("limitError", () => {
  it("maps the three outcomes to nothing, 'rate_limited' and 'unavailable'", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await limitError("k", 1, 60)).toBeUndefined();
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await limitError("k", 1, 60)).toBe("rate_limited");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "x" } });
    expect(await limitError("k", 1, 60)).toBe("unavailable");
  });
});

describe("clientIp", () => {
  it("takes the first forwarded IP (Vercel sets x-forwarded-for), then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
