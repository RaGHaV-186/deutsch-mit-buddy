import "fake-indexeddb/auto";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openStore } from "@/lib/cards/offline-store";
import type { SnapshotResponse } from "@/lib/cards/schema";
import { makeCard, seenCard } from "@/lib/cards/test-helpers";
import { renderWithIntl } from "@/test-utils";

vi.mock("@/lib/speech", () => ({ speak: vi.fn(), stopSpeaking: vi.fn() }));
vi.mock("@/app/(app)/cards/actions", () => ({ importSeedDeckAction: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));

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
    renderWithIntl(<CardsApp userId="u1" isAdmin={false} />);

    await screen.findByText("1 card to review");
    expect(screen.getByText("1 new card today")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Offline");

    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    expect(await screen.findByText("2 left")).toBeInTheDocument();
    expect(screen.getByText("dog")).toBeInTheDocument(); // due reviews come first

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByTestId("german")).toHaveTextContent("der Hund");
    fireEvent.click(screen.getByRole("button", { name: /^Got it/ }));
    await screen.findByText("cat");
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Easy/ }));

    await screen.findByText("Wuff! Session done");
    expect(screen.getByText("You answered 2 cards.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Offline · 2 reviews waiting to sync"));

    // Everything is in IndexedDB, nothing was sent.
    const store = await openStore();
    expect(await store.pendingCount()).toBe(2);
    expect((await store.info("u1", new Date()))!.newToday).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(0);
  });

  it("filters by mode and remembers the choice", async () => {
    await seedDevice("u1", [makeCard({ kind: "word" }), makeCard({ kind: "say", article: null }), makeCard({ kind: "answer", article: null })]);
    renderWithIntl(<CardsApp userId="u1" isAdmin={false} />);
    await screen.findByText("3 new cards today");
    fireEvent.click(screen.getByRole("radio", { name: "Words" }));
    expect(screen.getByText("1 new card today")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Speaking" }));
    expect(screen.getByText("2 new cards today")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("buddy.cards.prefs")!)).toMatchObject({ mode: "speaking" });
  });

  it("respects the daily limit of new cards, and what was already started today", async () => {
    await seedDevice("u1", Array.from({ length: 30 }, () => makeCard()), 8);
    renderWithIntl(<CardsApp userId="u1" isAdmin={false} />);
    await screen.findByText("12 new cards today");
    expect(screen.getByText("18 more new cards wait for tomorrow")).toBeInTheDocument();
  });

  it("explains itself when this phone has no cards yet", async () => {
    renderWithIntl(<CardsApp userId="u1" isAdmin={false} />);
    expect(await screen.findByText(/No cards on this phone yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start review" })).not.toBeInTheDocument();
  });

  it("never shows another account's cards left on a shared phone", async () => {
    await seedDevice("someone-else", [makeCard({ de: "Geheim", en: "secret" })]);
    renderWithIntl(<CardsApp userId="u1" isAdmin={false} />);
    await screen.findByText(/No cards on this phone yet/);
    expect(screen.queryByText("Geheim")).not.toBeInTheDocument();
  });

  it("only the admin sees the import button", async () => {
    await seedDevice("u1", [makeCard()]);
    const { unmount } = renderWithIntl(<CardsApp userId="u1" isAdmin={false} />);
    await screen.findByText("1 new card today");
    expect(screen.queryByRole("button", { name: "Import seed deck" })).not.toBeInTheDocument();
    unmount();
    renderWithIntl(<CardsApp userId="u1" isAdmin />);
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

    renderWithIntl(<CardsApp userId="u1" isAdmin={false} />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    const sent = JSON.parse(String(fetchMock.mock.calls.find((c) => c[0] === "/api/cards/sync")![1]!.body));
    expect(sent.reviews.map((r: { id: string }) => r.id)).toEqual(queued.map((q) => q.id));
    const store2 = await openStore();
    expect(await store2.pendingCount()).toBe(0);
    expect(screen.getByText(/Nothing left for today/)).toBeInTheDocument();
  });
});
