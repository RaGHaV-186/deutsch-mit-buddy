import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { clientIp, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows while the database says yes and blocks on no", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await rateLimit("k", 5, 60)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("hit_rate_limit", { p_key: "k", p_limit: 5, p_window_seconds: 60 });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await rateLimit("k", 5, 60)).toBe(false);
  });
  it("fails closed on errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: new Error("db down") });
    expect(await rateLimit("k", 5, 60)).toBe(false);
  });
  it("takes the first forwarded IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
