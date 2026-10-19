import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubEvent } from "./sentry-scrub";

describe("scrubEvent", () => {
  it("drops cookies, headers, body, query string, IP and email", () => {
    const event = {
      type: undefined,
      request: {
        url: "https://x.de/auth/confirm?token_hash=secret",
        cookies: { sb: "token" },
        headers: { cookie: "sb=token" },
        data: { password: "p" },
        query_string: "token_hash=secret",
      },
      user: { id: "u1", email: "a@b.de", ip_address: "1.2.3.4" },
    } as ErrorEvent;
    const out = scrubEvent(event);
    expect(out.request).toEqual({ url: "https://x.de/auth/confirm" });
    expect(out.user).toEqual({ id: "u1" });
  });
});
