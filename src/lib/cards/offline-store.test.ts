import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { newSrsState } from "@/lib/srs";
import { openStore, type OfflineStore } from "./offline-store";
import type { SnapshotResponse } from "./schema";
import { makeCard, seenCard } from "./test-helpers";

const NOW = new Date("2026-10-20T10:00:00Z");
const snapshotOf = (cards: ReturnType<typeof makeCard>[], newToday = 0): SnapshotResponse => ({
  now: NOW.toISOString(),
  timezone: "Europe/Berlin",
  newToday,
  cards,
});

let store: OfflineStore;
beforeEach(async () => {
  // A fresh database for each test.
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  store = await openStore("test");
});

describe("OfflineStore", () => {
  it("has no deck until a snapshot is stored, and ignores another account's deck", async () => {
    expect(await store.info("u1", NOW)).toBeNull();
    await store.replaceSnapshot("u1", snapshotOf([makeCard()]), NOW);
    expect(await store.info("u1", NOW)).toMatchObject({ userId: "u1", timezone: "Europe/Berlin", newToday: 0 });
    expect(await store.info("u2", NOW)).toBeNull();
  });

  it("stores a review and the new schedule together, and the deck survives closing and reopening", async () => {
    const card = seenCard("2026-10-20T08:00:00Z");
    await store.replaceSnapshot("u1", snapshotOf([card]), NOW);
    const updated = await store.recordReview(card.id, "good", 1500, NOW);
    expect(updated.srs.reps).toBe(2);
    expect(updated.srs.lastReviewedAt).toBe(NOW.toISOString());

    store.close();
    const reopened = await openStore("test");
    expect((await reopened.getCards())[0].srs).toEqual(updated.srs);
    expect(await reopened.getQueue()).toEqual([
      expect.objectContaining({ cardId: card.id, grade: "good", reviewedAt: NOW.toISOString(), msTaken: 1500 }),
    ]);
    expect(await reopened.pendingCount()).toBe(1);
  });

  it("gives every review its own id, and keeps the queue in time order", async () => {
    const a = makeCard();
    const b = makeCard();
    await store.replaceSnapshot("u1", snapshotOf([a, b]), NOW);
    await store.recordReview(b.id, "good", 1, new Date("2026-10-20T10:05:00Z"));
    await store.recordReview(a.id, "easy", 1, new Date("2026-10-20T10:01:00Z"));
    const queue = await store.getQueue();
    expect(queue.map((e) => e.cardId)).toEqual([a.id, b.id]);
    expect(new Set(queue.map((e) => e.id)).size).toBe(2);
  });

  it("clamps an absurd time-taken value so the server accepts it", async () => {
    const card = makeCard();
    await store.replaceSnapshot("u1", snapshotOf([card]), NOW);
    await store.recordReview(card.id, "good", 10 * 3_600_000, NOW);
    expect((await store.getQueue())[0].msTaken).toBe(600_000);
  });

  it("refuses to review a card it doesn't have, and stores nothing", async () => {
    await expect(store.recordReview("00000000-0000-4000-8000-00000000dead", "good", 1, NOW)).rejects.toThrow();
    expect(await store.pendingCount()).toBe(0);
  });

  it("counts new cards started today, not reviews of old cards", async () => {
    const fresh = makeCard();
    const old = seenCard("2026-10-20T08:00:00Z");
    await store.replaceSnapshot("u1", snapshotOf([fresh, old], 3), NOW);
    expect((await store.info("u1", NOW))!.newToday).toBe(3);
    await store.recordReview(old.id, "good", 1, NOW);
    expect((await store.info("u1", NOW))!.newToday).toBe(3);
    await store.recordReview(fresh.id, "good", 1, NOW);
    expect((await store.info("u1", NOW))!.newToday).toBe(4);
  });

  it("starts the count again on the next local day", async () => {
    const fresh = makeCard();
    await store.replaceSnapshot("u1", snapshotOf([fresh], 5), NOW);
    expect((await store.info("u1", new Date("2026-10-21T08:00:00Z")))!.newToday).toBe(0);
  });

  it("removes only the acknowledged events", async () => {
    const [a, b] = [makeCard(), makeCard()];
    await store.replaceSnapshot("u1", snapshotOf([a, b]), NOW);
    await store.recordReview(a.id, "good", 1, NOW, "11111111-1111-4111-8111-111111111111");
    await store.recordReview(b.id, "good", 1, NOW, "22222222-2222-4222-8222-222222222222");
    await store.removeFromQueue(["11111111-1111-4111-8111-111111111111"]);
    expect((await store.getQueue()).map((e) => e.id)).toEqual(["22222222-2222-4222-8222-222222222222"]);
  });

  it("takes the server's schedule but keeps answers given in the meantime", async () => {
    const card = makeCard();
    await store.replaceSnapshot("u1", snapshotOf([card]), NOW);
    const later = new Date("2026-10-20T10:30:00Z");
    await store.recordReview(card.id, "good", 1, later); // still queued
    const serverState = { ...newSrsState(NOW), reps: 1, intervalDays: 2, lastReviewedAt: "2026-10-20T10:10:00.000Z", dueAt: "2026-10-22T10:10:00.000Z" };
    await store.applyServerCards([{ id: card.id, srs: serverState }]);
    const [stored] = await store.getCards();
    expect(stored.srs.reps).toBe(2); // server's 1 + the queued answer on top
    expect(stored.srs.lastReviewedAt).toBe(later.toISOString());
  });

  it("wipes a different account's data on claim, and clear() empties everything", async () => {
    const card = makeCard();
    await store.replaceSnapshot("u1", snapshotOf([card]), NOW);
    await store.recordReview(card.id, "good", 1, NOW);
    await store.claimFor("u1");
    expect(await store.pendingCount()).toBe(1);
    await store.claimFor("u2");
    expect(await store.getCards()).toEqual([]);
    expect(await store.pendingCount()).toBe(0);
    expect(await store.info("u1", NOW)).toBeNull();
  });
});
