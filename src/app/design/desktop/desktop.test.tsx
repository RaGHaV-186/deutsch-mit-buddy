import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils";

vi.mock("../demos", () => ({ FlashcardDemo: () => <p>flashcard demo</p>, CodeDemo: () => null, ToastDemo: () => null, ErrorDemo: () => null }));
vi.mock("@/components/AuthForms", () => ({ LoginForm: () => <form>login form</form>, SignUpForm: () => <form>sign-up form</form> }));

import DesktopPreview from "./[screen]/page";

afterEach(() => vi.unstubAllEnvs());
const render = async (screen: string, searchParams: Record<string, string> = {}) =>
  renderWithIntl(await DesktopPreview({ params: Promise.resolve({ screen }), searchParams: Promise.resolve(searchParams) }));

describe("/design/desktop/[screen]", () => {
  it("is hidden in production unless SHOW_DESIGN_PAGE=1, and unknown screens are not found", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHOW_DESIGN_PAGE", "");
    await expect(render("home")).rejects.toThrow();
    vi.stubEnv("SHOW_DESIGN_PAGE", "1");
    await expect(render("home")).resolves.toBeTruthy();
    await expect(render("nope")).rejects.toThrow();
  });

  it.each(["landing", "login", "signup", "home", "learn", "play", "me", "flashcard"])("%s renders", async (screen) => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = await render(screen, { theme: "dark" });
    expect(container.querySelector('[data-theme="dark"]')).not.toBeNull();
    expect(container.textContent!.length).toBeGreaterThan(10);
  });

  it("home with game=0 has no game layer, with the default it has treats and the streak", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await render("home", { game: "0" })).container.textContent).not.toMatch(/treats|streak|Level/);
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
    expect((await render("home")).container.textContent).toMatch(/10-day streak/);
  });

  it("passes no functions to client components", () => {
    const page = readFileSync("src/app/design/desktop/[screen]/page.tsx", "utf8");
    expect(page).not.toMatch(/\bon[A-Z][A-Za-z]*=\{/);
  });
});
