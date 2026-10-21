import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCard } from "@/lib/cards/test-helpers";
import type { SnapshotCard } from "@/lib/cards/schema";
import { schedule } from "@/lib/srs";
import { renderWithIntl } from "@/test-utils";

const speak = vi.fn();
vi.mock("@/lib/speech", () => ({ speak: (...a: unknown[]) => speak(...a), stopSpeaking: vi.fn() }));

import { ReviewSession } from "./ReviewSession";

const stadt = () => makeCard({ kind: "word", article: "die", de: "Stadt", en: "city", plural: "die Städte", example: "Bielefeld ist eine Stadt.", exampleEn: "Bielefeld is a city.", tip: "-t → die" });
const hund = () => makeCard({ kind: "word", article: "der", de: "Hund", en: "dog" });
const say = () => makeCard({ kind: "say", article: null, en: "My name is Raghav.", de: "Ich heiße Raghav.", plural: null, example: null, exampleEn: null, tip: "ich → -e" });

const answerFn = () =>
  vi.fn(async (card: SnapshotCard, grade: Parameters<typeof schedule>[1]) => ({ ...card, srs: schedule(card.srs, grade, new Date()) }));

interface Over {
  cards?: SnapshotCard[];
  direction?: "en-de" | "de-en";
  gameLayer?: boolean;
  onAnswer?: ReturnType<typeof answerFn>;
  onFinish?: ReturnType<typeof vi.fn>;
  onOptions?: ReturnType<typeof vi.fn>;
}
const session = (o: Over = {}) =>
  renderWithIntl(
    <ReviewSession
      cards={o.cards ?? [hund(), stadt()]}
      direction={o.direction ?? "en-de"}
      gameLayer={o.gameLayer ?? false}
      onAnswer={o.onAnswer ?? answerFn()}
      onFinish={(o.onFinish ?? vi.fn()) as (answered: number, treats: number) => void}
      onOptions={(o.onOptions ?? vi.fn()) as () => void}
    />,
  );
const flip = () => fireEvent.click(screen.getByRole("button", { name: "Show answer" }));

beforeEach(() => {
  vi.clearAllMocks();
  speak.mockResolvedValue("spoken");
});

describe("layout (focus mode)", () => {
  it("has Close, a wedge progress bar with a paw marker, '2 left' and an options button; no tab bar", () => {
    const { container } = session();
    expect(screen.getByRole("button", { name: "End session" })).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Session progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar.querySelector("svg")).not.toBeNull(); // the paw marker
    expect(screen.getByText("2 left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Options" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    expect(container.querySelector(".rounded-coat-card")).not.toBeNull(); // the coat strip of the card
  });

  it("the coat strip names the direction (English → German) while there is no combo", () => {
    const { container } = session();
    expect(container.querySelector(".rounded-coat-card")).toHaveTextContent("English → German");
  });

  it("progress and the count follow the answers", async () => {
    session();
    flip();
    fireEvent.click(screen.getByRole("button", { name: /^Got it/ }));
    await waitFor(() => expect(screen.getByText("1 left")).toBeInTheDocument());
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("Options opens the options callback; Close ends the session with what was answered", () => {
    const onOptions = vi.fn();
    const onFinish = vi.fn();
    session({ onOptions, onFinish });
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(onOptions).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "End session" }));
    expect(onFinish).toHaveBeenCalledWith(0, 0);
  });
});

describe("card faces (CLAUDE.md card format)", () => {
  it("English first, then the full back: coloured article + word, plural line, meaning, example + English, tip", () => {
    session({ cards: [stadt()] });
    expect(screen.getByTestId("front")).toHaveTextContent("city");
    expect(screen.queryByTestId("german")).toBeNull();
    flip();
    const german = screen.getByTestId("german");
    expect(german).toHaveTextContent("die Stadt");
    expect(within(german).getByText("die")).toHaveStyle({ color: "var(--die)" });
    expect(screen.getByText("Plural · die Städte")).toBeInTheDocument();
    expect(screen.getByText("city")).toBeInTheDocument();
    expect(screen.getByText("Bielefeld ist eine Stadt.")).toBeInTheDocument();
    expect(screen.getByText("Bielefeld is a city.")).toBeInTheDocument();
    expect(screen.getByText("-t → die")).toBeInTheDocument();
  });

  it("verbs show their forms line as it is, not as a plural", () => {
    session({ cards: [makeCard({ kind: "word", article: null, de: "heißen", en: "to be called", plural: "ich heiße · du heißt", example: null, exampleEn: null })] });
    flip();
    expect(screen.getByText("ich heiße · du heißt")).toBeInTheDocument();
    expect(screen.queryByText(/^Plural/)).toBeNull();
  });

  it("speaking cards: 'Say it in German' / 'Answer out loud'", () => {
    const answer = makeCard({ kind: "answer", article: null, en: "Answer (in a café): Was möchten Sie?", de: "Ich möchte einen Tee.", plural: null, example: null, exampleEn: null });
    session({ cards: [say(), answer] });
    expect(screen.getByText("Say it in German")).toBeInTheDocument();
    expect(screen.getByText("My name is Raghav.")).toBeInTheDocument();
  });

  it("German → English: the German word is on the front", () => {
    session({ cards: [stadt()], direction: "de-en" });
    expect(screen.getByTestId("front")).toHaveTextContent("die Stadt");
    expect(screen.queryByText("city")).toBeNull();
  });
});

describe("grading", () => {
  it("shows Again / Hard / Got it / Easy with when each comes back; Got it is the filled one", () => {
    session({ cards: [hund()] });
    expect(screen.queryByRole("button", { name: /Got it/ })).toBeNull();
    flip();
    const group = screen.getByRole("group", { name: "How well did you know it?" });
    expect(within(group).getAllByRole("button")).toHaveLength(4);
    expect(within(group).getByRole("button", { name: /^Again/ })).toHaveTextContent("10 min");
    expect(within(group).getByRole("button", { name: /^Easy/ })).toHaveTextContent("4 days");
    expect(within(group).getByRole("button", { name: /^Got it/ }).className).toContain("bg-primary");
    expect(within(group).getByRole("button", { name: /^Hard/ }).className).toContain("shadow-cushion");
    expect(group.className).toContain("grid-cols-2");
  });

  it("reports the grade, moves on, finishes after the last card", async () => {
    const onAnswer = answerFn();
    const onFinish = vi.fn();
    const [a, b] = [hund(), stadt()];
    session({ cards: [a, b], onAnswer, onFinish });
    flip();
    fireEvent.click(screen.getByRole("button", { name: /^Hard/ }));
    await waitFor(() => expect(screen.getByText("1 left")).toBeInTheDocument());
    expect(onAnswer).toHaveBeenCalledWith(a, "hard", expect.any(Number));
    flip();
    fireEvent.click(screen.getByRole("button", { name: /^Easy/ }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(2, 0));
  });

  it("an 'Again' card comes back a few cards later in the same session", async () => {
    session({ cards: [hund(), stadt()] });
    flip();
    fireEvent.click(screen.getByRole("button", { name: /^Again/ }));
    await waitFor(() => expect(screen.getByTestId("front")).toHaveTextContent("city"));
    expect(screen.getByText("2 left")).toBeInTheDocument();
    flip();
    fireEvent.click(screen.getByRole("button", { name: /^Got it/ }));
    await waitFor(() => expect(screen.getByTestId("front")).toHaveTextContent("dog"));
  });

  it("keyboard: Space shows the answer, then plays the word; 1-4 grade", async () => {
    const onAnswer = answerFn();
    session({ onAnswer });
    fireEvent.keyDown(window, { key: "3" }); // not flipped yet: ignored
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByTestId("german")).toHaveTextContent("der Hund");
    fireEvent.keyDown(window, { key: " " });
    expect(speak).toHaveBeenCalledWith("der Hund");
    fireEvent.keyDown(window, { key: "3" });
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(expect.anything(), "good", expect.any(Number)));
  });

  it("tapping the unflipped card shows the answer", () => {
    session({ cards: [hund()] });
    fireEvent.click(screen.getByTestId("front"));
    expect(screen.getByTestId("german")).toBeInTheDocument();
  });
});

describe("audio on the coat strip", () => {
  it("Play word, Play sentence and Slow (which repeats the last one slowly)", async () => {
    const { container } = session({ cards: [stadt()] });
    expect(screen.queryByRole("button", { name: "Play word" })).toBeNull(); // English front: nothing to play
    flip();
    const strip = container.querySelector(".rounded-coat-card") as HTMLElement;
    expect(within(strip).getByRole("button", { name: "Play word" })).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play word" })));
    expect(speak).toHaveBeenLastCalledWith("die Stadt", { slow: false });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Slow" })));
    expect(speak).toHaveBeenLastCalledWith("die Stadt", { slow: true });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play sentence" })));
    expect(speak).toHaveBeenLastCalledWith("Bielefeld ist eine Stadt.", { slow: false });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Slow" })));
    expect(speak).toHaveBeenLastCalledWith("Bielefeld ist eine Stadt.", { slow: true });
  });

  it("German → English: the German on the front can be played before flipping", () => {
    session({ cards: [stadt()], direction: "de-en" });
    fireEvent.click(screen.getByRole("button", { name: "Play word" }));
    expect(speak).toHaveBeenCalledWith("die Stadt", { slow: false });
  });

  it("says so when the device has no German voice", async () => {
    speak.mockResolvedValue("no-voice");
    session({ cards: [stadt()] });
    flip();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play word" })));
    expect(screen.getByRole("status")).toHaveTextContent(/no German voice/);
  });
});

describe("game layer off (production)", () => {
  it("no combo, no treat labels, no floating chip, whatever the answers", async () => {
    const { container } = session({ cards: [hund(), hund(), hund(), hund(), hund()], gameLayer: false });
    for (let i = 0; i < 4; i++) {
      flip();
      expect(container.textContent).not.toMatch(/treats|in a row/i);
      fireEvent.click(screen.getByRole("button", { name: /^Easy/ }));
      await waitFor(() => expect(screen.getByText(`${4 - i} left`)).toBeInTheDocument());
    }
    expect(container.textContent).not.toMatch(/treats|in a row/i);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("game layer on", () => {
  it("treat rewards on the buttons: Again +0, Hard +5, Got it +10, Easy +15, next to when the card returns", () => {
    session({ cards: [hund()], gameLayer: true });
    flip();
    expect(screen.getByRole("button", { name: /^Again/ })).toHaveTextContent("10 min · +0 treats");
    expect(screen.getByRole("button", { name: /^Hard/ })).toHaveTextContent("+5 treats");
    expect(screen.getByRole("button", { name: /^Got it/ })).toHaveTextContent("+10 treats");
    expect(screen.getByRole("button", { name: /^Easy/ })).toHaveTextContent("+15 treats");
  });

  it("a +N chip floats up after an answer that earns treats, and the total goes to onFinish", async () => {
    const onFinish = vi.fn();
    session({ cards: [hund(), hund()], gameLayer: true, onFinish });
    flip();
    fireEvent.click(screen.getByRole("button", { name: /^Got it/ }));
    const chip = await screen.findByRole("status");
    expect(chip).toHaveTextContent("+10 treats");
    expect(chip.className).toContain("ds-float-up");
    flip();
    fireEvent.click(screen.getByRole("button", { name: /^Easy/ }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(2, 25));
  });

  it("no chip for Again (it earns nothing)", async () => {
    session({ cards: [hund(), hund()], gameLayer: true });
    flip();
    fireEvent.click(screen.getByRole("button", { name: /^Again/ }));
    await waitFor(() => expect(screen.getByText("2 left")).toBeInTheDocument());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("combo chip from 3 answers in a row (Got it / Easy); Hard keeps it, Again resets it", async () => {
    session({ cards: Array.from({ length: 8 }, hund), gameLayer: true });
    const answer = async (name: RegExp, left: number) => {
      flip();
      fireEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(screen.getByText(`${left} left`)).toBeInTheDocument());
    };
    await answer(/^Got it/, 7);
    await answer(/^Easy/, 6);
    expect(screen.queryByText(/in a row/)).toBeNull();
    await answer(/^Got it/, 5);
    expect(screen.getByText("3 in a row")).toBeInTheDocument();
    await answer(/^Hard/, 4);
    expect(screen.getByText("3 in a row")).toBeInTheDocument();
    await answer(/^Easy/, 3);
    expect(screen.getByText("4 in a row")).toBeInTheDocument();
    await answer(/^Again/, 3); // goes to the back of the queue, so the count stays
    expect(screen.queryByText(/in a row/)).toBeNull();
  });
});
