import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAal2FromClaims = vi.fn();
const getProfile = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/auth/guard", () => ({ requireAal2FromClaims: (...a: unknown[]) => requireAal2FromClaims(...a) }));
vi.mock("@/lib/profile", () => ({ getProfile: (...a: unknown[]) => getProfile(...a) }));
vi.mock("@/components/ServiceWorkerRegister", () => ({ ServiceWorkerRegister: () => null }));
vi.mock("@/components/AppChromeLive", () => ({ AppChromeLive: ({ children }: { children: unknown }) => children }));

import AppLayout from "./layout";

beforeEach(() => {
  vi.clearAllMocks();
  requireAal2FromClaims.mockResolvedValue({ userId: "u1" });
});

describe("(app) layout", () => {
  it("a token without an account (no profile row) ends the session through /auth/stale, once, instead of looping", async () => {
    getProfile.mockResolvedValue(null);
    await expect(AppLayout({ children: null })).rejects.toThrow("REDIRECT:/auth/stale");
  });

  it("an account that has not finished onboarding goes to onboarding", async () => {
    getProfile.mockResolvedValue({ display_name: "Anna", onboarded_at: null });
    await expect(AppLayout({ children: null })).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("an onboarded member sees the app", async () => {
    getProfile.mockResolvedValue({ display_name: "Anna", onboarded_at: "2026-10-01T00:00:00Z" });
    await expect(AppLayout({ children: null })).resolves.toBeTruthy();
  });
});
