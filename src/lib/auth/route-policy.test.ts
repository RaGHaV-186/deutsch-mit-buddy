import { describe, expect, it } from "vitest";
import { decideRoute, type SessionClaims } from "./route-policy";

const none = null;
const aal1: SessionClaims = { sub: "u1", aal: "aal1" };
const aal2: SessionClaims = { sub: "u1", aal: "aal2" };

describe("decideRoute", () => {
  it.each(["/", "/login", "/signup", "/forgot-password", "/waitlist", "/check-email", "/impressum", "/datenschutz", "/terms", "/offline", "/api/health", "/auth/callback", "/auth/confirm"])(
    "lets everyone open public %s",
    (path) => {
      for (const claims of [none, aal1]) expect(decideRoute(path, claims)).toEqual({ type: "next" });
    },
  );

  it("sends signed-in (AAL2) members away from login and sign-up", () => {
    for (const p of ["/login", "/signup", "/forgot-password"]) {
      expect(decideRoute(p, aal2)).toEqual({ type: "redirect", to: "/home" });
    }
    expect(decideRoute("/", aal2)).toEqual({ type: "next" });
  });

  it("sends signed-out visitors to login and remembers where they were going", () => {
    expect(decideRoute("/home", none)).toEqual({ type: "redirect", to: "/login?next=%2Fhome" });
    expect(decideRoute("/cards", none, "?mode=speaking")).toEqual({
      type: "redirect",
      to: "/login?next=%2Fcards%3Fmode%3Dspeaking",
    });
  });

  it("sends password-only (AAL1) sessions to 2FA for every app page", () => {
    for (const p of ["/home", "/onboarding", "/learn/lesson", "/anything-else"]) {
      expect(decideRoute(p, aal1)).toEqual({ type: "redirect", to: "/mfa" });
    }
  });

  it("lets a session without 2FA reach only the MFA screens and reset-password", () => {
    for (const p of ["/mfa", "/mfa/setup", "/mfa/verify", "/reset-password"]) {
      expect(decideRoute(p, aal1)).toEqual({ type: "next" });
    }
    expect(decideRoute("/mfa", none)).toEqual({ type: "redirect", to: "/login?next=%2Fmfa" });
  });

  it("does not treat look-alike paths as public or MFA", () => {
    expect(decideRoute("/mfa-fake", aal1)).toEqual({ type: "redirect", to: "/mfa" });
    expect(decideRoute("/authx", none).type).toBe("redirect");
    expect(decideRoute("/loginx", aal1)).toEqual({ type: "redirect", to: "/mfa" });
  });

  it("lets AAL2 members into app pages, trailing slash or not", () => {
    expect(decideRoute("/home", aal2)).toEqual({ type: "next" });
    expect(decideRoute("/home/", aal2)).toEqual({ type: "next" });
    expect(decideRoute("/login/", aal2)).toEqual({ type: "redirect", to: "/home" });
  });

  it("answers API routes with JSON, never a redirect", () => {
    expect(decideRoute("/api/feedback", none)).toEqual({ type: "json", status: 401, error: "unauthenticated" });
    expect(decideRoute("/api/feedback", aal1)).toEqual({ type: "json", status: 403, error: "mfa_required" });
    expect(decideRoute("/api/feedback", aal2)).toEqual({ type: "next" });
    expect(decideRoute("/api/mfa-bypass", aal1).type).toBe("json");
  });
});
