import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPasswordPwned } from "./hibp";

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();

afterEach(() => vi.restoreAllMocks());

describe("isPasswordPwned", () => {
  it("sends only the 5-character prefix and detects a hit", async () => {
    const hash = sha1("password1234");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(`${hash.slice(5)}:42\r\n0000000000000000000000000000000000A:0\r\n`),
    );
    expect(await isPasswordPwned("password1234")).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
  });
  it("ignores padding rows (count 0) and misses", async () => {
    const hash = sha1("a-unique-passphrase-9z");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`${hash.slice(5)}:0\r\nABCDEF:3\r\n`));
    expect(await isPasswordPwned("a-unique-passphrase-9z")).toBe(false);
  });
  it("fails open when the API is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await isPasswordPwned("whatever-long-password")).toBe(false);
  });
});
