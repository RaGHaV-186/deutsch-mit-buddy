import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { theme } from "./theme";

describe("theme", () => {
  it("uses the der/die/das colours from CLAUDE.md", () => {
    expect(theme.article.der).toBe("#2457C5");
    expect(theme.article.die).toBe("#C3303A");
    expect(theme.article.das).toBe("#1E8A4C");
  });

  it("keeps globals.css variables in sync with the theme", () => {
    const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();
    expect(css).toContain(`--der: ${theme.article.der.toLowerCase()}`);
    expect(css).toContain(`--die: ${theme.article.die.toLowerCase()}`);
    expect(css).toContain(`--das: ${theme.article.das.toLowerCase()}`);
  });
});
