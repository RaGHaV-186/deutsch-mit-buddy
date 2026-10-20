import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colors, radii, shadows, themeColor, type ColorToken } from "./theme";

const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();
const tokens = Object.keys(colors.light) as ColorToken[];

/** The text of one CSS block, from its selector to the closing brace at the same nesting depth. */
function block(selector: string): string {
  const start = css.indexOf(selector.toLowerCase());
  expect(start, `missing ${selector}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`unclosed ${selector}`);
}

describe("theme tokens match the design brief", () => {
  it("has the brief's key values", () => {
    expect(colors.light).toMatchObject({ bg: "#F2F3F5", surface: "#FFFFFF", coat: "#5E6875", tint: "#F1D3CC", der: "#2457A8", die: "#B83A32", das: "#2B7550" });
    expect(colors.dark).toMatchObject({ bg: "#16191E", surface: "#20252B", coat: "#333B46", tint: "#43363A", der: "#8DB4F2", die: "#F29A90", das: "#7CCB9C" });
    expect(themeColor).toEqual({ light: "#5E6875", dark: "#333B46" });
    expect(radii.coat).toBe("0 0 40px 72px");
    expect(radii.coatCard).toBe("0 0 28px 56px");
  });
});

describe("globals.css mirrors src/theme.ts", () => {
  it("light values in :root", () => {
    const root = block(":root {");
    for (const token of tokens) expect(root).toContain(`--${token}: ${colors.light[token].toLowerCase()};`);
    expect(root).toContain(shadows.light.toLowerCase());
  });

  it("dark values for the system setting, unless the learner chose light", () => {
    const media = block("@media (prefers-color-scheme: dark)");
    expect(media).toContain(':root:not([data-theme="light"])');
    for (const token of tokens) expect(media).toContain(`--${token}: ${colors.dark[token].toLowerCase()};`);
    expect(media).toContain(shadows.dark.toLowerCase());
  });

  it("dark values when the learner chose dark", () => {
    const manual = block(':root[data-theme="dark"]');
    for (const token of tokens) expect(manual).toContain(`--${token}: ${colors.dark[token].toLowerCase()};`);
    expect(manual).toContain(shadows.dark.toLowerCase());
  });

  it("every token is available to Tailwind as a colour", () => {
    for (const token of tokens) expect(css).toContain(`--color-${token}: var(--${token});`);
  });

  it("radii follow the brief", () => {
    expect(css).toContain("--radius-coat: 0 0 40px 72px;");
    expect(css).toContain("--radius-coat-card: 0 0 28px 56px;");
    expect(css).toContain("--radius-tabbar: 34px;");
  });
});

// WCAG contrast. Text pairs must reach AA (4.5:1); the focus ring is a non-text indicator (3:1).
function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT_PAIRS: [ColorToken, ColorToken][] = [
  ["text", "bg"],
  ["text", "surface"],
  ["muted", "bg"],
  ["muted", "surface"],
  ["muted", "track"],
  ["der", "surface"],
  ["der", "bg"],
  ["die", "surface"],
  ["die", "bg"],
  ["das", "surface"],
  ["das", "bg"],
  ["on-coat", "coat"],
  ["on-coat-muted", "coat"],
  ["on-coat", "bubble"],
  ["on-coat-muted", "bubble"],
  ["on-blaze", "blaze"],
  ["on-tint", "tint"],
];

describe("contrast", () => {
  for (const mode of ["light", "dark"] as const) {
    it.each(TEXT_PAIRS)(`${mode}: %s on %s reaches 4.5:1`, (fg, bg) => {
      expect(contrast(colors[mode][fg], colors[mode][bg])).toBeGreaterThanOrEqual(4.5);
    });

    // Not asserted: --coat fill on --track is only ~1.1:1 in dark mode (the approved reference image looks the same),
    // so a wedge progress bar on the page is hard to read there. Raised with the design owner; tokens are unchanged.
    it(`${mode}: progress fill stands out from its track on the coat block (3:1)`, () => {
      expect(contrast(colors[mode]["on-coat"], colors[mode]["coat-track"])).toBeGreaterThanOrEqual(3);
    });

    it(`${mode}: the focus ring is visible on the page and on cards (3:1)`, () => {
      expect(contrast(colors[mode].focus, colors[mode].bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(colors[mode].focus, colors[mode].surface)).toBeGreaterThanOrEqual(3);
    });
  }
});
