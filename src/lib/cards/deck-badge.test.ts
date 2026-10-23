import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { readDueBadge } from "./deck-badge";
import { openStore } from "./offline-store";
import type { SnapshotResponse } from "./schema";
import { makeCard, seenCard } from "./test-helpers";

const NOW = new Date("2026-10-20T10:00:00Z");
const snapshotOf = (cards: ReturnType<typeof makeCard>[], newToday = 0): SnapshotResponse => ({
  now: NOW.toISOString(),
  timezone: "Europe/Berlin",
  newToday,
  cards,
});

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe("readDueBadge", () => {
  it("is 0 on a device without a deck, and for another account's deck", async () => {
    expect(await readDueBadge("u1", NOW, "test")).toBe(0);
    const store = await openStore("test");
    await store.replaceSnapshot("u1", snapshotOf([makeCard()]), NOW);
    store.close();
    expect(await readDueBadge("u2", NOW, "test")).toBe(0);
  });

  it("counts reviews due today plus the new cards still allowed today", async () => {
    const store = await openStore("test");
    const due = [seenCard("2026-10-20T08:00:00Z"), seenCard("2026-10-19T08:00:00Z")];
    const later = seenCard("2026-10-25T08:00:00Z");
    const fresh = Array.from({ length: 25 }, () => makeCard());
    await store.replaceSnapshot("u1", snapshotOf([...due, later, ...fresh], 5), NOW);
    store.close();
    // 2 due + (20 daily limit - 5 already started) new cards
    expect(await readDueBadge("u1", NOW, "test")).toBe(2 + 15);
  });
});
