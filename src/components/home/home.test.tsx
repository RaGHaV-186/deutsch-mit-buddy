import { SESSIONS, indexOfCode } from "@data/curriculum";
import { createTranslator } from "next-intl";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppChromeProvider, AppNav } from "@/components/ds";
import { renderWithIntl } from "@/test-utils";
import messages from "../../../messages/en.json";

const requireAal2 = vi.fn();
const getProfile = vi.fn();
const getDueCounts = vi.fn();

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => createTranslator({ locale: "en", messages, namespace: namespace as never }),
}));
vi.mock("@/lib/auth/guard", () => ({ requireAal2: (...a: unknown[]) => requireAal2(...a) }));
vi.mock("@/lib/profile", () => ({ getProfile: (...a: unknown[]) => getProfile(...a) }));
vi.mock("@/lib/cards/server", () => ({ getDueCounts: (...a: unknown[]) => getDueCounts(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

import HomePage from "@/app/(app)/home/page";
import { GAME_PREVIEW } from "@/lib/game-layer";
import { homeAction } from "@/lib/home-action";
import { HomeSkeleton } from "./HomeSkeleton";
import { HomeView } from "./HomeView";
import { TabPlaceholder } from "./TabPlaceholder";

const lesson = { day: 11, code: "Z9", title: "Essen & Trinken" };
const view = (over: Partial<React.ComponentProps<typeof HomeView>> = {}) =>
  renderWithIntl(<HomeView name="Raghav" line="Heute geht's um Essen!" lesson={lesson} due={29} game={null} {...over} />);

afterEach(() => vi.unstubAllEnvs());

describe("HomeView with the game layer off (what production shows)", () => {
  it("coat header: greeting, Buddy's line in quotes, happy Buddy, today's lesson and Continue", () => {
    const { container } = view();
    const header = container.querySelector("header")!;
    expect(header.className).toContain("rounded-coat");
    expect(screen.getByRole("heading", { level: 1, name: "Hallo, Raghav!" })).toBeInTheDocument();
    expect(header).toHaveTextContent("„Heute geht's um Essen!“");
    expect(header.querySelector("img")!.getAttribute("src")).toContain("buddy-happy");
    expect(header).toHaveTextContent("Day 11 · Z9");
    expect(screen.getByRole("heading", { level: 2, name: "Essen & Trinken" })).toBeInTheDocument();
    // Lessons are published, so the button opens the Learn tab.
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/learn");
    expect(screen.queryByRole("link", { name: "Review cards" })).toBeNull();
  });

  it("with lesson content switched off the button leads to today's cards, not to a coming-soon page", () => {
    view({ action: homeAction(false) });
    expect(screen.getByRole("link", { name: "Review cards" })).toHaveAttribute("href", "/cards");
  });

  it("cards due is a link to the deck", () => {
    view();
    const tile = screen.getByRole("link", { name: /29/ });
    expect(tile).toHaveAttribute("href", "/cards");
    expect(tile).toHaveTextContent("cards due");
  });

  it("shows NONE of the game layer: no streak, level, treats, or preview note", () => {
    const { container } = view();
    expect(container.textContent).not.toMatch(/treats|streak|level|preview/i);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0); // the paw week is a list
  });

  it("the tab bar has Home active", () => {
    view();
    expect(screen.getAllByRole("link", { name: "Home" })[0]).toHaveAttribute("aria-current", "page");
  });

  it("without a name or a lesson it still works: plain Hallo!, no lesson block", () => {
    view({ name: null, lesson: null });
    expect(screen.getByRole("heading", { level: 1, name: "Hallo!" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.getByRole("link", { name: "Continue" })).toBeInTheDocument();
  });
});

describe("HomeView with the game layer on", () => {
  it("adds the treats chip, the paw week, the level card and a preview note", () => {
    view({ game: GAME_PREVIEW });
    expect(screen.getByText("+50 treats")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "10-day streak" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Level 3" })).toBeInTheDocument();
    expect(screen.getByText(/Preview data/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /29/ })).toHaveAttribute("href", "/cards"); // real data stays real
  });

  it("no preview note for real game data", () => {
    view({ game: { ...GAME_PREVIEW, preview: false } });
    expect(screen.queryByText(/Preview data/)).toBeNull();
    expect(screen.getByText("+50 treats")).toBeInTheDocument();
  });
});

describe("HomePage (server component)", () => {
  beforeEach(() => {
    requireAal2.mockResolvedValue({ userId: "u1" });
    getProfile.mockResolvedValue({ display_name: "Raghav", session_seq: indexOfCode("Z9"), day_count: 11, timezone: "Europe/Berlin", onboarded_at: "x" });
    getDueCounts.mockResolvedValue({ due: 24, fresh: 5 });
  });

  it("builds Home from the profile and the due counts: real data only, production flag off", async () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_LAYER", "0");
    const { container } = renderWithIntl(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Hallo, Raghav!" })).toBeInTheDocument();
    expect(container).toHaveTextContent("Day 11 · Z9");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(SESSIONS[indexOfCode("Z9")].theme);
    expect(screen.getByRole("link", { name: /29/ })).toHaveAttribute("href", "/cards"); // 24 due + 5 new
    expect(container.textContent).not.toMatch(/treats|streak|level/i);
    expect(requireAal2).toHaveBeenCalled();
  });

  it("with the flag on it shows the preview game layer", async () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_LAYER", "1");
    renderWithIntl(await HomePage());
    expect(screen.getByText("+50 treats")).toBeInTheDocument();
    expect(screen.getByText(/Preview data/)).toBeInTheDocument();
  });

  it("copes with a failed cards count and a profile without a name", async () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_LAYER", "0");
    getDueCounts.mockResolvedValue(null);
    getProfile.mockResolvedValue({ display_name: null, session_seq: indexOfCode("Z1"), day_count: 1, timezone: null, onboarded_at: "x" });
    renderWithIntl(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Hallo!" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cards due/ })).toHaveTextContent("0");
  });

  it("has no account actions: those live on the Me screen", async () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_LAYER", "0");
    renderWithIntl(await HomePage());
    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send feedback" })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Theme" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Me" })[0]).toHaveAttribute("href", "/me");
  });
});

describe("HomeSkeleton", () => {
  it("is the Home layout in grey blocks, announced once as loading, with the real tab bar", () => {
    const { container } = renderWithIntl(<HomeSkeleton game={false} />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelector("header")!.className).toContain("rounded-coat");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
    expect(screen.getAllByRole("link", { name: "Cards" })[0]).toHaveAttribute("href", "/cards");
    expect(container.textContent).not.toMatch(/Hallo|streak|treats/i);
  });

  it("has game-layer blocks only when that layer is on", () => {
    const off = renderWithIntl(<HomeSkeleton game={false} />).container.querySelectorAll(".animate-pulse").length;
    const on = renderWithIntl(<HomeSkeleton game />).container.querySelectorAll(".animate-pulse").length;
    expect(on).toBeGreaterThan(off);
  });
});

describe("tab placeholders", () => {
  it.each([["learn", "Learn"], ["play", "Play"]] as const)("%s: title, Buddy's „Kommt bald!“, coming soon, tab bar", (tab, label) => {
    const { container } = renderWithIntl(<TabPlaceholder tab={tab} />);
    expect(screen.getByRole("heading", { level: 1, name: label })).toBeInTheDocument();
    expect(container.querySelector("header")).toHaveTextContent("„Kommt bald!“");
    expect(container).toHaveTextContent("Coming soon");
    expect(screen.getAllByRole("link", { name: label })[0]).toHaveAttribute("aria-current", "page");
  });
});

describe("desktop sidebar (shown from 1024px, hidden on phones by CSS)", () => {
  it("has the four rows, Cards with its due badge, and Me pinned with the learner's initial", async () => {
    renderWithIntl(
      <AppChromeProvider value={{ initial: "R", due: 49 }}>
        <AppNav active="cards" />
      </AppChromeProvider>,
    );
    const sidebar = document.querySelector("aside")!;
    expect(sidebar.className).toContain("hidden");
    expect(sidebar.className).toContain("desk:flex");
    const links = Array.from(sidebar.querySelectorAll("a")).map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Home", "/home"],
      ["Learn", "/learn"],
      ["Cards4949 cards to review", "/cards"],
      ["Play", "/play"],
      ["RMeSettings", "/me"],
    ]);
    expect(sidebar.querySelector('a[aria-current="page"]')).toHaveTextContent("Cards");
    expect(sidebar).toHaveTextContent("Deutsch mit Buddy");
    // The phone tab bar is still there; CSS hides it on desktop.
    expect(document.querySelector("nav.desk\\:hidden, div.desk\\:hidden nav")).not.toBeNull();
  });

  it("no badge when nothing is due", () => {
    renderWithIntl(
      <AppChromeProvider value={{ initial: "", due: 0 }}>
        <AppNav active="home" />
      </AppChromeProvider>,
    );
    expect(document.querySelector("aside")).not.toHaveTextContent("cards to review");
  });
});

describe("route-level loading files", () => {
  // A loading.tsx next to Home made the page's content intermittently never hydrate in a production build (dead links,
  // theme switch and Log out). Until the cause is understood, no screen uses one; HomeSkeleton is only previewed on /design.
  it("there are none under src/app", () => {
    const find = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? find(join(dir, e.name)) : /^loading\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
    expect(find("src/app")).toEqual([]);
  });
});
