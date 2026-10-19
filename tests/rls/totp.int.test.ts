import { describe, expect, it } from "vitest";
import { totp } from "./totp";

describe("totp helper", () => {
  // RFC 6238 Appendix B: ASCII secret "12345678901234567890", T=59s -> 94287082 (8 digits).
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  it("matches the RFC 6238 test vector", () => {
    expect(totp(secret, 59_000, 8)).toBe("94287082");
    expect(totp(secret, 59_000, 6)).toBe("287082");
  });
});
