import { readFileSync } from "node:fs";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Splash } from "@/components/ds/Splash";
import { SplashGate } from "@/components/ds/SplashGate";
import { shouldShowSplash, SPLASH_ATTRIBUTE, SPLASH_STORAGE_KEY, splashInitScript } from "./splash";

const html = () => document.documentElement;

function runInit({ standalone = false, iosStandalone = false, search = "" } = {}) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: standalone && q.includes("standalone") }));
  Object.defineProperty(window.navigator, "standalone", { value: iosStandalone, configurable: true });
  window.history.replaceState(null, "", `/home${search}`);
  new Function(splashInitScript)();
}

beforeEach(() => {
  sessionStorage.clear();
  html().removeAttribute(SPLASH_ATTRIBUTE);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("shouldShowSplash", () => {
  it("only for the installed app, once per session", () => {
    expect(shouldShowSplash({ standalone: true, search: "", seen: false })).toBe(true);
    expect(shouldShowSplash({ standalone: true, search: "", seen: true })).toBe(false);
    expect(shouldShowSplash({ standalone: false, search: "", seen: false })).toBe(false);
  });
  it("?splash=1 forces it (for review)", () => {
    expect(shouldShowSplash({ standalone: false, search: "?splash=1", seen: true })).toBe(true);
    expect(shouldShowSplash({ standalone: false, search: "?a=1&splash=1", seen: false })).toBe(true);
    expect(shouldShowSplash({ standalone: false, search: "?splash=10", seen: false })).toBe(false);
  });
});

describe("splash init script (runs before first paint)", () => {
  it("marks <html> in the installed app on the first load of a session", () => {
    runInit({ standalone: true });
    expect(html().hasAttribute(SPLASH_ATTRIBUTE)).toBe(true);
  });

  it("also for iOS home-screen apps (navigator.standalone)", () => {
    runInit({ iosStandalone: true });
    expect(html().hasAttribute(SPLASH_ATTRIBUTE)).toBe(true);
  });

  it("not in a normal browser tab, so there is no flash", () => {
    runInit({ standalone: false });
    expect(html().hasAttribute(SPLASH_ATTRIBUTE)).toBe(false);
  });

  it("not again after it has been shown in this session", () => {
    sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
    runInit({ standalone: true });
    expect(html().hasAttribute(SPLASH_ATTRIBUTE)).toBe(false);
  });

  it("?splash=1 shows it anywhere", () => {
    sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
    runInit({ standalone: false, search: "?splash=1" });
    expect(html().hasAttribute(SPLASH_ATTRIBUTE)).toBe(true);
  });

  it("never throws, even without matchMedia or with blocked storage", () => {
    vi.stubGlobal("matchMedia", undefined);
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() => new Function(splashInitScript)()).not.toThrow();
    } finally {
      Storage.prototype.getItem = real;
    }
  });

  it("is self-contained and small", () => {
    expect(splashInitScript).not.toMatch(/\bimport\b|\brequire\b/);
    expect(splashInitScript.length).toBeLessThan(700);
  });
});

describe("Splash", () => {
  it("shows Buddy (neutral, 120px) and the app name, and is hidden from screen readers", () => {
    const { container } = render(<Splash title="Deutsch mit Buddy" />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("id", "app-splash");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.className).toBe("splash");
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toContain("buddy-neutral.svg");
    expect(img).toHaveAttribute("width", "120");
    expect(root).toHaveTextContent("Deutsch mit Buddy");
  });

  it("the preview variant is placed in the page instead of covering the screen", () => {
    const { container } = render(<Splash title="Deutsch mit Buddy" preview />);
    expect(container.firstElementChild!.className).toBe("splash-preview");
    expect(container.firstElementChild).not.toHaveAttribute("id");
  });
});

describe("SplashGate", () => {
  it("does nothing when no splash is showing", () => {
    render(<SplashGate />);
    expect(sessionStorage.getItem(SPLASH_STORAGE_KEY)).toBeNull();
  });

  it("when the app has started: remembers it, fades the splash out, then removes the marker", () => {
    vi.useFakeTimers();
    html().setAttribute(SPLASH_ATTRIBUTE, "");
    const { container } = render(
      <>
        <Splash title="x" />
        <SplashGate />
      </>,
    );
    expect(sessionStorage.getItem(SPLASH_STORAGE_KEY)).toBe("1");
    expect(container.querySelector("#app-splash")!.classList.contains("is-leaving")).toBe(true);
    expect(html().hasAttribute(SPLASH_ATTRIBUTE)).toBe(true);
    act(() => vi.advanceTimersByTime(300));
    expect(html().hasAttribute(SPLASH_ATTRIBUTE)).toBe(false);
  });

  it("still works when storage is blocked", () => {
    vi.useFakeTimers();
    html().setAttribute(SPLASH_ATTRIBUTE, "");
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() => render(<SplashGate />)).not.toThrow();
      act(() => vi.advanceTimersByTime(300));
      expect(html().hasAttribute(SPLASH_ATTRIBUTE)).toBe(false);
    } finally {
      Storage.prototype.setItem = real;
    }
  });
});

describe("splash styles", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  it("covers the screen in the coat colour, but only while <html data-splash> is set", () => {
    expect(css).toMatch(/\.splash \{\s*display: none;\s*position: fixed;\s*inset: 0;/);
    expect(css).toContain("background: var(--coat);");
    expect(css).toMatch(/html\[data-splash\] \.splash \{\s*display: flex;/);
  });

  it("the spinner only appears after one second", () => {
    expect(css).toMatch(/\.splash-spinner \{[^}]*opacity: 0;/);
    expect(css).toContain("ds-appear 0.2s ease-out 1s forwards");
  });
});
