import { act, fireEvent, screen, waitFor } from "@testing-library/react";
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

beforeEach(() => {
  vi.clearAllMocks();
  speak.mockResolvedValue("spoken");
});

describe("ReviewSession", () => {
  it("shows English first, then the full card back after 'Show answer'", () => {
    renderWithIntl(<ReviewSession cards={[stadt()]} direction="en-de" onAnswer={answerFn()} onFinish={vi.fn()} />);
    expect(screen.getByText("city")).toBeInTheDocument();
    expect(screen.queryByText("Stadt")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Got it/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    const german = screen.getByTestId("german");
    expect(german).toHaveTextContent("die Stadt");
    expect(german).toHaveStyle({ color: "var(--article-die)" });
    expect(screen.getByText("die Städte")).toBeInTheDocument();
    expect(screen.getByText("city")).toBeInTheDocument();
    expect(screen.getByText("Bielefeld ist eine Stadt.")).toBeInTheDocument();
    expect(screen.getByText("Bielefeld is a city.")).toBeInTheDocument();
    expect(screen.getByText("-t → die")).toBeInTheDocument();
    for (const name of [/^Again/, /^Hard/, /^Got it/, /^Easy/]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("shows when each button will bring the card back", () => {
    renderWithIntl(<ReviewSession cards={[hund()]} direction="en-de" onAnswer={answerFn()} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByRole("button", { name: /Again/ })).toHaveTextContent("10 min");
    expect(screen.getByRole("button", { name: /Easy/ })).toHaveTextContent("4 days");
  });

  it("reports the grade and moves on; finishes after the last card", async () => {
    const onAnswer = answerFn();
    const onFinish = vi.fn();
    const [a, b] = [hund(), stadt()];
    renderWithIntl(<ReviewSession cards={[a, b]} direction="en-de" onAnswer={onAnswer} onFinish={onFinish} />);
    expect(screen.getByText("2 left")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Hard/ }));
    await waitFor(() => expect(screen.getByText("1 left")).toBeInTheDocument());
    expect(onAnswer).toHaveBeenCalledWith(a, "hard", expect.any(Number));
    expect(screen.getByText("city")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Easy/ }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(2));
  });

  it("brings an 'Again' card back a few cards later in the same session", async () => {
    const onAnswer = answerFn();
    const [a, b] = [hund(), stadt()];
    renderWithIntl(<ReviewSession cards={[a, b]} direction="en-de" onAnswer={onAnswer} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Again/ }));
    await waitFor(() => expect(screen.getByText("city")).toBeInTheDocument());
    expect(screen.getByText("2 left")).toBeInTheDocument(); // dog is still in the queue
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Got it/ }));
    await waitFor(() => expect(screen.getByText("dog")).toBeInTheDocument());
  });

  it("works from the keyboard: Space flips, 1-4 grade", async () => {
    const onAnswer = answerFn();
    renderWithIntl(<ReviewSession cards={[hund(), stadt()]} direction="en-de" onAnswer={onAnswer} onFinish={vi.fn()} />);
    fireEvent.keyDown(window, { key: "3" }); // not flipped yet: ignored
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByTestId("german")).toHaveTextContent("der Hund");
    fireEvent.keyDown(window, { key: "3" });
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(expect.anything(), "good", expect.any(Number)));
  });

  it("ends the session on request and reports how many were answered", () => {
    const onFinish = vi.fn();
    renderWithIntl(<ReviewSession cards={[hund()]} direction="en-de" onAnswer={answerFn()} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole("button", { name: "End session" }));
    expect(onFinish).toHaveBeenCalledWith(0);
  });

  it("speaking cards: 'Say it in German', and 'Answer out loud' for answer cards", () => {
    const answer = makeCard({ kind: "answer", article: null, en: "Answer (in a café): Was möchten Sie?", de: "Ich möchte einen Tee.", plural: null, example: null, exampleEn: null });
    renderWithIntl(<ReviewSession cards={[say(), answer]} direction="en-de" onAnswer={answerFn()} onFinish={vi.fn()} />);
    expect(screen.getByText("Say it in German")).toBeInTheDocument();
    expect(screen.getByText("My name is Raghav.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play word" })).not.toBeInTheDocument();
  });

  it("German → English: the German word is on the front and can be played before flipping", () => {
    renderWithIntl(<ReviewSession cards={[stadt()]} direction="de-en" onAnswer={answerFn()} onFinish={vi.fn()} />);
    expect(screen.getByText(/die Stadt/)).toBeInTheDocument();
    expect(screen.queryByText("city")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play word" }));
    expect(speak).toHaveBeenCalledWith("die Stadt", { slow: false });
  });

  describe("audio", () => {
    it("plays the word, the sentence, and slow repeats the one played last", async () => {
      renderWithIntl(<ReviewSession cards={[stadt()]} direction="en-de" onAnswer={answerFn()} onFinish={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Play word" })).not.toBeInTheDocument(); // English front: nothing to play
      fireEvent.click(screen.getByRole("button", { name: "Show answer" }));

      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play word" })));
      expect(speak).toHaveBeenLastCalledWith("die Stadt", { slow: false });
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Slow" })));
      expect(speak).toHaveBeenLastCalledWith("die Stadt", { slow: true });
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play sentence" })));
      expect(speak).toHaveBeenLastCalledWith("Bielefeld ist eine Stadt.", { slow: false });
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Slow" })));
      expect(speak).toHaveBeenLastCalledWith("Bielefeld ist eine Stadt.", { slow: true });
    });

    it("tells the learner when the device has no German voice", async () => {
      speak.mockResolvedValue("no-voice");
      renderWithIntl(<ReviewSession cards={[stadt()]} direction="en-de" onAnswer={answerFn()} onFinish={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play word" })));
      expect(screen.getByRole("status")).toHaveTextContent(/no German voice/);
    });
  });
});
