import { beforeEach, describe, expect, it } from "vitest";
import {
  applyThemePreference,
  readThemePreference,
  setThemePreference,
  THEME_STORAGE_KEY,
  themeInitScript,
} from "./theme-mode";

const html = () => document.documentElement;
const metas = () => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => [m.getAttribute("media"), m.getAttribute("content")]);

beforeEach(() => {
  localStorage.clear();
  html().removeAttribute("data-theme");
  document.head.innerHTML =
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#5E6875">' +
    '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#333B46">';
});

describe("theme preference", () => {
  it("defaults to the system setting, also for junk or unreadable storage", () => {
    expect(readThemePreference()).toBe("system");
    localStorage.setItem(THEME_STORAGE_KEY, "purple");
    expect(readThemePreference()).toBe("system");
    expect(readThemePreference({ getItem: () => { throw new Error("blocked"); } })).toBe("system");
  });

  it("setting dark or light writes data-theme, remembers the choice, and recolours the browser chrome", () => {
    setThemePreference("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readThemePreference()).toBe("dark");
    expect(metas().map((m) => m[1])).toEqual(["#333B46", "#333B46"]);

    setThemePreference("light");
    expect(html().getAttribute("data-theme")).toBe("light");
    expect(metas().map((m) => m[1])).toEqual(["#5E6875", "#5E6875"]);
  });

  it("going back to system removes the override and restores each tag's own colour", () => {
    setThemePreference("dark");
    setThemePreference("system");
    expect(html().hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(metas()).toEqual([
      ["(prefers-color-scheme: light)", "#5E6875"],
      ["(prefers-color-scheme: dark)", "#333B46"],
    ]);
  });

  it("still applies the choice when storage is blocked", () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() => setThemePreference("dark")).not.toThrow();
      expect(html().getAttribute("data-theme")).toBe("dark");
    } finally {
      Storage.prototype.setItem = real;
    }
  });

  it("applyThemePreference works on any document", () => {
    const other = document.implementation.createHTMLDocument("x");
    applyThemePreference("dark", other);
    expect(other.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(html().hasAttribute("data-theme")).toBe(false);
  });
});

describe("themeInitScript (runs before first paint)", () => {
  const run = () => new Function(themeInitScript)();

  it("applies a saved light or dark choice immediately", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(metas().map((m) => m[1])).toEqual(["#333B46", "#333B46"]);
  });

  it("also recolours theme-color tags that are added later", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();
    const late = document.createElement("meta");
    late.setAttribute("name", "theme-color");
    late.setAttribute("media", "(prefers-color-scheme: light)");
    late.setAttribute("content", "#5E6875");
    document.head.appendChild(late);
    await Promise.resolve();
    expect(late.getAttribute("content")).toBe("#333B46");
  });

  it("does nothing for system, missing or invalid values", () => {
    run();
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    run();
    localStorage.setItem(THEME_STORAGE_KEY, "<script>");
    run();
    expect(html().hasAttribute("data-theme")).toBe(false);
  });

  it("never throws, even if storage is blocked", () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(run).not.toThrow();
    } finally {
      Storage.prototype.getItem = real;
    }
  });

  it("is self-contained (no imports) and small enough to inline", () => {
    expect(themeInitScript).not.toMatch(/\bimport\b|\brequire\b/);
    expect(themeInitScript.length).toBeLessThan(800);
  });
});
