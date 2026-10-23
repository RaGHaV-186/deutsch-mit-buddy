import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitError = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession } }) }));
vi.mock("@/lib/rate-limit", () => ({ limitError: (...a: unknown[]) => limitError(...a), clientIp: () => "203.0.113.9" }));

import { GET } from "./route";

const where = (res: Response) => {
  const u = new URL(res.headers.get("location")!);
  return u.pathname + u.search;
};

beforeEach(() => {
  vi.clearAllMocks();
  limitError.mockResolvedValue(undefined);
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("GET /auth/callback (Google sign-in)", () => {
  it("is limited per IP and does nothing else when over the limit", async () => {
    limitError.mockResolvedValue("rate_limited");
    expect(where(await GET(new NextRequest("http://localhost:3000/auth/callback?code=abc")))).toBe("/login?error=rate_limited");
    expect(limitError).toHaveBeenCalledWith("callback:203.0.113.9", 30, 600);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("exchanges the code and hands over to /mfa", async () => {
    expect(where(await GET(new NextRequest("http://localhost:3000/auth/callback?code=abc")))).toBe("/mfa");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });
});
