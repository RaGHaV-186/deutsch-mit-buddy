import "fake-indexeddb/auto";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openStore } from "@/lib/cards/offline-store";
import type { SnapshotResponse } from "@/lib/cards/schema";
import { makeCard, seenCard } from "@/lib/cards/test-helpers";
import { renderWithIntl } from "@/test-utils";

vi.mock("@/lib/speech", () => ({ speak: vi.fn(), stopSpeaking: vi.fn() }));
vi.mock("@/app/(app)/cards/actions", () => ({ importSeedDeckAction: vi.fn() }));

import { CardsApp } from "./CardsApp";

const NOW = new Date();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

async function seedDevice(userId: string, cards: SnapshotResponse["cards"], newToday = 0) {
  const store = await openStore();
  await store.replaceSnapshot(userId, { now: NOW.toISOString(), timezone: "Europe/Berlin", newToday, cards }, NOW);
  store.close();
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
}

const app = (over: Partial<React.ComponentProps<typeof CardsApp>> = {}) =>
  renderWithIntl(<CardsApp userId="u1" isAdmin={false} gameLayer={false} {...over} />);

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  setOnline(true);
});

describe("Cards screen, offline (airplane mode)", () => {
  beforeEach(() => {
    setOnline(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  });

  it("opens from the cards on the phone, reviews them, and keeps the answers for later", async () => {
    const due = seenCard(hoursAgo(5), { kind: "word", article: "der", de: "Hund", en: "dog" });
    const fresh = makeCard({ kind: "word", article: "die", de: "Katze", en: "cat" });
    await seedDevice("u1", [due, fresh]);
    const { container } = app();

    // Hub: the Cards tab, with the tab bar, today's counts and the offline note.
    await screen.findByText("1 card to review");
    expect(screen.getByText("1 new card today")).toBeInTheDocument();
    expect(container.querySelector("header")!.className).toContain("rounded-coat");
    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("status")).toHaveTextContent("Offline");

    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    expect(await screen.findByText("2 left")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull(); // focus mode
    expect(screen.getByTestId("front")).toHaveTextContent("dog"); // due reviews come first

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByTestId("german")).toHaveTextContent("der Hund");
    fireEvent.click(screen.getByRole("button", { name: /^Got it/ }));
    await waitFor(() => expect(screen.getByTestId("front")).toHaveTextContent("cat"));
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Easy/ }));

    // End of session.
    await screen.findByText("Wuff! Session done");
    expect(screen.getByText("You answered 2 cards.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/home");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Offline · 2 reviews waiting to sync"));

    // Everything is in IndexedDB, nothing was sent.
    const store = await openStore();
    expect(await store.pendingCount()).toBe(2);
    expect((await store.info("u1", new Date()))!.newToday).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(0);
  });

  it("the done screen has no treats when the game layer is off, and a treats chip when it is on", async () => {
    await seedDevice("u1", [makeCard({ kind: "word" })]);
    const { unmount } = app({ gameLayer: false });
    fireEvent.click(await screen.findByRole("button", { name: "Start review" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Got it/ }));
    await screen.findByText("Wuff! Session done");
    expect(document.body.textContent).not.toMatch(/treats/i);
    expect(document.querySelector('img[src="/buddy/buddy-happy.svg"]')).not.toBeNull();
    unmount();

    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    await seedDevice("u1", [makeCard({ kind: "word" })]);
    app({ gameLayer: true });
    fireEvent.click(await screen.findByRole("button", { name: "Start review" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Got it/ }));
    await screen.findByText("Wuff! Session done");
    expect(screen.getAllByText("+10 treats").length).toBeGreaterThan(0);
    expect(document.querySelector('img[src="/buddy/buddy-happy.svg"]')).not.toBeNull();
  });

  it("mode and direction live behind the Options button; the choice is remembered", async () => {
    await seedDevice("u1", [makeCard({ kind: "word" }), makeCard({ kind: "say", article: null }), makeCard({ kind: "answer", article: null })]);
    app();
    await screen.findByText("3 new cards today");
    expect(screen.queryByRole("radiogroup", { name: "What to practise" })).toBeNull(); // not cluttering the screen

    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    const sheet = screen.getByRole("dialog", { name: "Options" });
    expect(within(sheet).getByRole("radio", { name: "Both" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(sheet).getByRole("radio", { name: "Words" }));
    expect(screen.getByText("1 new card today")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("radio", { name: "Speaking" }));
    expect(screen.getByText("2 new cards today")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("radio", { name: "German → English" }));
    expect(JSON.parse(localStorage.getItem("buddy.cards.prefs")!)).toMatchObject({ mode: "speaking", direction: "de-en" });

    fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the options sheet closes with Escape and returns focus to the button", async () => {
    await seedDevice("u1", [makeCard()]);
    app();
    const button = await screen.findByRole("button", { name: "Options" });
    button.focus();
    fireEvent.click(button);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it("direction changes live in a session; a new mode starts a fresh queue without the cards just answered", async () => {
    const w1 = makeCard({ kind: "word", article: "der", de: "Hund", en: "dog" });
    const w2 = makeCard({ kind: "word", article: "die", de: "Katze", en: "cat" });
    const s1 = makeCard({ kind: "say", article: null, en: "My name is Raghav.", de: "Ich heiße Raghav.", plural: null, example: null, exampleEn: null });
    await seedDevice("u1", [w1, w2, s1]);
    app();
    fireEvent.click(await screen.findByRole("button", { name: "Start review" }));
    await screen.findByText("3 left");

    // Answer the first card (dog).
    expect(screen.getByTestId("front")).toHaveTextContent("dog");
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Got it/ }));
    await screen.findByText("2 left");

    // Flip the direction while the next card (cat) is showing.
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    const sheet = screen.getByRole("dialog", { name: "Options" });
    expect(within(sheet).getByText(/starts a fresh queue/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("radio", { name: "German → English" }));
    expect(screen.getByTestId("front")).toHaveTextContent("die Katze");

    // Switch to Speaking: only the sentence card is left, and the answered dog is not offered again.
    fireEvent.click(within(sheet).getByRole("radio", { name: "Speaking" }));
    expect(await screen.findByText("1 left")).toBeInTheDocument();
    expect(screen.getByTestId("front")).toHaveTextContent("Ich heiße Raghav.");
  });

  it("respects the daily limit of new cards, and what was already started today", async () => {
    await seedDevice("u1", Array.from({ length: 30 }, () => makeCard()), 8);
    app();
    await screen.findByText("12 new cards today");
    expect(screen.getByText("18 more new cards wait for tomorrow")).toBeInTheDocument();
  });

  it("with nothing due the Start button is disabled and Buddy rests", async () => {
    await seedDevice("u1", [seenCard(new Date(NOW.getTime() + 5 * 86_400_000).toISOString())]);
    const { container } = app();
    await screen.findByText(/Nothing left for today/);
    expect(screen.getByRole("button", { name: "Start review" })).toBeDisabled();
    expect(container.querySelector("header img")!.getAttribute("src")).toContain("buddy-resting");
  });

  it("explains itself when this phone has no cards yet", async () => {
    app();
    expect(await screen.findByText(/No cards on this phone yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start review" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cards" })).toHaveAttribute("aria-current", "page"); // tab bar stays
  });

  it("never shows another account's cards left on a shared phone", async () => {
    await seedDevice("someone-else", [makeCard({ de: "Geheim", en: "secret" })]);
    app();
    await screen.findByText(/No cards on this phone yet/);
    expect(screen.queryByText("Geheim")).not.toBeInTheDocument();
  });

  it("only the admin sees the import button", async () => {
    await seedDevice("u1", [makeCard()]);
    const { unmount } = app();
    await screen.findByText("1 new card today");
    expect(screen.queryByRole("button", { name: "Import seed deck" })).not.toBeInTheDocument();
    unmount();
    app({ isAdmin: true });
    expect(await screen.findByRole("button", { name: "Import seed deck" })).toBeInTheDocument();
  });
});

describe("Cards screen, back online", () => {
  it("sends the reviews made offline, then shows the server's schedule", async () => {
    setOnline(true);
    const due = seenCard(hoursAgo(2), { de: "Hund", en: "dog", article: "der" });
    await seedDevice("u1", [due]);
    const store = await openStore();
    const updated = await store.recordReview(due.id, "good", 800, new Date());
    const queued = await store.getQueue();
    store.close();

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/cards/sync") {
        const body = JSON.parse(String(init?.body));
        return Response.json({ acknowledged: body.reviews.map((r: { id: string }) => r.id), cards: [{ id: due.id, srs: updated.srs }] });
      }
      return Response.json({ now: new Date().toISOString(), timezone: "Europe/Berlin", newToday: 0, cards: [{ ...due, srs: updated.srs }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    app();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    const sent = JSON.parse(String(fetchMock.mock.calls.find((c) => c[0] === "/api/cards/sync")![1]!.body));
    expect(sent.reviews.map((r: { id: string }) => r.id)).toEqual(queued.map((q) => q.id));
    const store2 = await openStore();
    expect(await store2.pendingCount()).toBe(0);
    expect(screen.getByText(/Nothing left for today/)).toBeInTheDocument();
  });
});
