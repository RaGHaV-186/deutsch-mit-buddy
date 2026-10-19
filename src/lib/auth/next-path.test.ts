import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/cards?mode=speaking")).toBe("/cards?mode=speaking");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", "cards", "/a\nb"])(
    "rejects %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/home");
    },
  );
  it("falls back for null and uses a custom fallback", () => {
    expect(safeNextPath(null)).toBe("/home");
    expect(safeNextPath(undefined, "/")).toBe("/");
  });
});
