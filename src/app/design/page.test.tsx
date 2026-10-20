import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils";

vi.mock("./demos", () => ({ CodeDemo: () => null, ToastDemo: () => null, ErrorDemo: () => null }));

import DesignPage from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("/design", () => {
  it("is hidden in production unless SHOW_DESIGN_PAGE=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHOW_DESIGN_PAGE", "");
    expect(() => DesignPage()).toThrow();
    vi.stubEnv("SHOW_DESIGN_PAGE", "1");
    expect(() => DesignPage()).not.toThrow();
  });

  it("is available in development and shows every component in light and dark", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = renderWithIntl(DesignPage());
    const light = container.querySelectorAll('[data-theme="light"]').length;
    const dark = container.querySelectorAll('[data-theme="dark"]').length;
    expect(light).toBeGreaterThan(10);
    expect(dark).toBe(light);
    for (const name of ["PillButton", "TextField", "CodeInput", "WedgeProgress", "FloatingTabBar", "PawStreakWeek", "ArticleWord", "CoatHeader"]) {
      expect(container.textContent).toContain(name);
    }
  });
});

describe("server component rules", () => {
  it("the page passes no functions to client components (that crashes the whole page with a global error)", () => {
    // Interactive demos live in demos.tsx, a client file. A handler such as onChange={() => {}} here breaks rendering.
    const page = readFileSync("src/app/design/page.tsx", "utf8");
    expect(page).not.toMatch(/\bon[A-Z][A-Za-z]*=\{/);
    expect(page).not.toMatch(/=\{\s*(?:async\s*)?\(?[\w,\s]*\)?\s*=>/);
  });
});

describe("no hard-coded colours outside the tokens", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

  it("design-system components and the /design page use token variables only", () => {
    const sources = [...files("src/components/ds"), ...files("src/app/design")].filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
    expect(sources.length).toBeGreaterThan(15);
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file).not.toMatch(/\brgba?\(|\bhsla?\(/);
    }
  });
});
