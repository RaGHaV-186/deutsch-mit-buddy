import { readFileSync } from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { CoatHeader, DueCardsTile, Screen } from "@/components/ds";
import { HomeView } from "@/components/home/HomeView";
import { FlashCard } from "@/components/cards/FlashCard";
import { buildCardView } from "@/lib/cards/display";
import { ReviewSession } from "@/components/cards/ReviewSession";
import { TabPlaceholder } from "@/components/home/TabPlaceholder";
import { makeCard } from "@/lib/cards/test-helpers";
import { GAME_PREVIEW } from "@/lib/game-layer";
import Landing from "@/app/page";

// Desktop (1024px and up) is made of responsive variants of the same components. jsdom has no CSS, so these tests check the
// markup that carries the variants: which elements exist, and which classes switch them on or off by width.

const css = readFileSync("src/app/globals.css", "utf8");

describe("breakpoints", () => {
  it("tab (768px) and desk (1024px) are custom variants that switch off inside a .phone-frame, tab defined first", () => {
    expect(css).toMatch(/@custom-variant tab \{\s*@media \(min-width: 768px\) \{\s*&:where\(:not\(\.phone-frame \*\)\)/);
    expect(css).toMatch(/@custom-variant desk \{\s*@media \(min-width: 1024px\) \{\s*&:where\(:not\(\.phone-frame \*\)\)/);
    expect(css.indexOf("@custom-variant tab")).toBeLessThan(css.indexOf("@custom-variant desk"));
  });
});

describe("Screen", () => {
  it("keeps the phone column (480px, 560px from 768px) and leaves room for the sidebar on desktop", () => {
    const { container } = render(<Screen withTabBar>x</Screen>);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.tagName).toBe("MAIN");
    expect(outer.className).toContain("desk:pl-[280px]");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner.className).toContain("max-w-[480px]");
    expect(inner.className).toContain("tab:max-w-[560px]");
    expect(inner.className).toContain("desk:max-w-[960px]");
  });

  it("narrow (Me, legal) is 640px on desktop", () => {
    const { container } = render(<Screen width="narrow">x</Screen>);
    expect((container.firstElementChild!.firstElementChild as HTMLElement).className).toContain("desk:max-w-[640px]");
  });
});

describe("CoatHeader", () => {
  it("is a hero card on desktop and, as a panel, a full-height left 45% with a notch on its right edge", () => {
    const hero = render(<CoatHeader>x</CoatHeader>).container.querySelector("header")!;
    expect(hero.className).toContain("desk:rounded-hero");
    const { container } = render(<CoatHeader desktop="panel">x</CoatHeader>);
    const panel = container.querySelector("header")!;
    expect(panel.className).toContain("desk:w-[45%]");
    expect(panel.className).toContain("desk:rounded-panel");
    const notches = container.querySelectorAll("svg");
    expect(notches).toHaveLength(2);
    expect(notches[0].getAttribute("class")).toContain("desk:hidden"); // the phone notch, at the bottom
    expect(notches[1].getAttribute("class")).toContain("desk:block"); // the desktop notch, pointing into the form
  });
});

describe("AuthLayout on desktop", () => {
  it("adds the app name, a tagline, a big Buddy and a form column of at most 420px; the heading above the form is desktop only", () => {
    const { container } = renderWithIntl(
      <AuthLayout title="Welcome back" line="Schön, dich zu sehen!" helper="Good to see you!" formTitle="Log in" formSubtitle="Pick up where you left off.">
        <form />
      </AuthLayout>,
    );
    const panel = container.querySelector("header")!;
    expect(panel).toHaveTextContent("Deutsch mit Buddy");
    expect(panel).toHaveTextContent("German from zero to C1, with your AI teacher dog.");
    expect(panel.querySelector('img[src*="buddy-neutral"]')!.getAttribute("class")).toContain("desk:w-[240px]");
    const heading = screen.getByRole("heading", { level: 2, name: "Log in" });
    expect(heading.parentElement!.className).toContain("hidden");
    expect(heading.parentElement!.className).toContain("desk:block");
    expect(container.querySelector("form")!.parentElement!.className).toContain("desk:max-w-[420px]");
  });
});

describe("Home on desktop", () => {
  const view = (game: typeof GAME_PREVIEW | null) =>
    renderWithIntl(
      <HomeView name="Raghav" line="Los geht's!" lesson={{ day: 11, code: "Z9", title: "Essen & Trinken" }} due={49} dueDetail={{ reviews: 29, fresh: 20 }} dateLabel="Dienstag, 20. Oktober" game={game} />,
    );

  it("shows the date only on desktop and puts Buddy bottom-right of the hero", () => {
    const { container } = view(null);
    const date = screen.getByText("Dienstag, 20. Oktober");
    expect(date.className).toContain("hidden");
    expect(date.className).toContain("desk:block");
    expect(container.querySelector('header img[src*="buddy-happy"]')!.getAttribute("class")).toContain("desk:absolute");
  });

  it("without the game layer the cards tile is one full-width bar with the reviews / new split", () => {
    const { container } = view(null);
    const tile = screen.getByRole("link", { name: /49/ });
    expect(tile.className).toContain("desk:col-span-3");
    expect(tile.className).toContain("desk:flex-row");
    expect(tile).toHaveTextContent("cards due · 29 reviews, 20 new");
    expect(container.textContent).not.toMatch(/streak|Level|treats/);
  });

  it("with the game layer it is three cards: cards due, streak, level", () => {
    view(GAME_PREVIEW);
    expect(screen.getByRole("link", { name: /49/ }).className).toContain("desk:order-1");
    expect(screen.getByRole("heading", { name: "10-day streak" }).closest("div")!.parentElement!.className).toContain("desk:order-2");
    expect(screen.getByRole("heading", { name: "Level 3" }).closest("div.flex-col")!.className).toContain("desk:order-3");
    expect(screen.getByText("Sunday is test day")).toBeInTheDocument();
  });
});

describe("DueCardsTile", () => {
  it("keeps the plain caption on phones when there is no split to show", () => {
    renderWithIntl(<DueCardsTile count={3} />);
    expect(screen.getByRole("link")).toHaveTextContent("cards due");
    expect(screen.getByRole("link")).not.toHaveTextContent("reviews");
  });
});

describe("Landing", () => {
  it("has the buttons twice, below the coat block on phones and inside the hero on desktop", () => {
    const { container } = renderWithIntl(<Landing />);
    const signUps = screen.getAllByRole("link", { name: "Sign up free" });
    expect(signUps).toHaveLength(2);
    expect(signUps[0].parentElement!.className).toContain("hidden"); // inside the hero: desktop only
    expect(signUps[1].parentElement!.className).toContain("desk:hidden"); // below the hero: phone only
    expect(container.querySelector("main")).not.toBeNull();
  });
});

describe("review session on desktop", () => {
  const cards = [makeCard({ en: "coffee", de: "Kaffee", article: "der", plural: "die Kaffees" }), makeCard({ en: "milk", de: "Milch", article: "die", plural: null })];
  const open = (gameLayer = false) => {
    const onOptions = vi.fn();
    renderWithIntl(
      <ReviewSession
        cards={cards}
        direction="en-de"
        gameLayer={gameLayer}
        onAnswer={async (c) => c}
        onFinish={() => {}}
        onOptions={onOptions}
        status={<p role="status">Saved</p>}
      />,
    );
    return onOptions;
  };

  it("has the offline chip top-right (desktop only) and the options button twice: top bar on phones, coat strip on desktop", () => {
    const onOptions = open();
    expect(screen.getByRole("status").parentElement!.className).toContain("desk:block");
    const buttons = screen.getAllByRole("button", { name: "Options" });
    expect(buttons).toHaveLength(2);
    expect(buttons[0].className).toContain("desk:hidden");
    expect(buttons[1].className).toContain("desk:flex");
    fireEvent.click(buttons[1]);
    expect(onOptions).toHaveBeenCalledTimes(1);
  });

  it("moves the direction label into the card body on desktop", () => {
    open();
    const labels = screen.getAllByText("English → German");
    expect(labels).toHaveLength(2);
    expect(labels.map((l) => l.className).sort()).toEqual([expect.stringContaining("desk:block"), expect.stringContaining("desk:hidden")]);
  });

  it("shows four grade buttons in one row with key hints 1 to 4 and the keyboard line", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    const group = screen.getByRole("group", { name: "How well did you know it?" });
    expect(group.className).toContain("desk:grid-cols-4");
    const hints = Array.from(group.querySelectorAll('span[aria-hidden="true"]')).map((s) => s.textContent);
    expect(hints).toEqual(["1", "2", "3", "4"]);
    expect(screen.getByText("Space to play · 1–4 to grade")).toBeInTheDocument();
    // The audio buttons keep their full names for assistive tech, and have short visible labels on desktop.
    const word = screen.getByRole("button", { name: "Play word" });
    expect(within(word).getByText("Word")).toBeInTheDocument();
  });
});

describe("Buddy's prompt on the flashcard front", () => {
  const word = makeCard({ kind: "word", en: "coffee", de: "Kaffee", article: "der" });
  const say = (card = word, dir: "en-de" | "de-en" = "en-de", flipped = false, combo: number | null = null) =>
    renderWithIntl(<FlashCard view={buildCardView(card, dir)} cardId={card.id} flipped={flipped} combo={combo} onOptions={() => {}} />);

  it("is German when the learner says it in German and English the other way round", () => {
    const first = say();
    expect(screen.getByText("„Wie sagt man das auf Deutsch?“")).toBeInTheDocument();
    first.unmount();
    say(word, "de-en");
    expect(screen.getByText("What's that in English?")).toBeInTheDocument();
    expect(screen.queryByText(/Wie sagt man/)).toBeNull();
  });

  it("has a prompt for answer cards too, and is gone on the back", () => {
    const answer = makeCard({ kind: "answer", en: "Answer: Wie geht's?", de: "Gut, danke.", article: null, plural: null });
    const first = say(answer);
    expect(screen.getByText("„Und was antwortest du?“")).toBeInTheDocument();
    first.unmount();
    say(word, "en-de", true);
    expect(screen.queryByText(/Wie sagt man/)).toBeNull();
  });

  it("sits beside the combo chip and the options button", () => {
    say(word, "en-de", false, 5);
    expect(screen.getByText("5 in a row")).toBeInTheDocument();
    expect(screen.getByText("„Wie sagt man das auf Deutsch?“")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Options" })).toBeInTheDocument();
  });

  it("speaking cards have no Word button on the back (they only have a sentence): that is intended", () => {
    const sayCard = makeCard({ kind: "say", en: "My name is Raghav.", de: "Ich heiße Raghav.", article: null, plural: null, example: null, exampleEn: null });
    say(sayCard, "en-de", true);
    expect(screen.queryByRole("button", { name: "Play word" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play sentence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Slow" })).toBeInTheDocument();
  });
});

describe("Learn and Play placeholders", () => {
  it("have Buddy once, in the hero", () => {
    const { container } = renderWithIntl(<TabPlaceholder tab="learn" />);
    expect(container.querySelectorAll('img[src*="/buddy/buddy-"]:not([src*="icon"])')).toHaveLength(1);
    expect(container).toHaveTextContent("Coming soon");
  });
});

describe("every auth screen has a heading above its form on desktop", () => {
  const pages = ["src/app/(auth)/login/page.tsx", "src/app/(auth)/signup/page.tsx", "src/app/(auth)/forgot-password/page.tsx", "src/app/(auth)/reset-password/page.tsx", "src/app/(auth)/check-email/page.tsx", "src/app/(auth)/waitlist/page.tsx", "src/app/mfa/setup/page.tsx", "src/app/mfa/verify/page.tsx", "src/app/onboarding/page.tsx"];
  it.each(pages)("%s passes formTitle", (file) => {
    expect(readFileSync(file, "utf8")).toMatch(/<AuthLayout[\s\S]*?formTitle=/);
  });
});
