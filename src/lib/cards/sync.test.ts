import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openStore, type OfflineStore } from "./offline-store";
import type { SnapshotResponse, SyncResponse } from "./schema";
import { syncNow } from "./sync";
import { makeCard, seenCard } from "./test-helpers";

const NOW = new Date("2026-10-20T10:00:00Z");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const snapshotOf = (cards: SnapshotResponse["cards"], newToday = 0): SnapshotResponse => ({
  now: NOW.toISOString(),
  timezone: "Europe/Berlin",
  newToday,
  cards,
});

let store: OfflineStore;
beforeEach(async () => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  store = await openStore("test");
});

/** A fake server: acknowledges everything it is sent and answers the snapshot with `snapshot`. */
function server(snapshot: SnapshotResponse, over: { sync?: () => Response } = {}) {
  const calls: { url: string; body: { reviews?: { id: string }[] } }[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ url, body });
    if (url === "/api/cards/sync") {
      if (over.sync) return over.sync();
      return json({ acknowledged: body.reviews.map((r: { id: string }) => r.id), cards: [] } satisfies SyncResponse);
    }
    return json(snapshot);
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

async function withQueue(n: number) {
  const cards = Array.from({ length: n }, () => seenCard("2026-10-20T08:00:00Z"));
  await store.replaceSnapshot("u1", snapshotOf(cards), NOW);
  for (const c of cards) await store.recordReview(c.id, "good", 1, NOW);
  return cards;
}

describe("syncNow", () => {
  it("sends the queue, clears it, then refreshes the deck", async () => {
    const [card] = await withQueue(2);
    const next = snapshotOf([makeCard({ de: "Katze" })], 1);
    const { fetchFn, calls } = server(next);
    const out = await syncNow(store, { userId: "u1", refresh: true, fetchFn, now: () => NOW });
    expect(out).toEqual({ status: "synced", pending: 0, refreshed: true });
    expect(calls.map((c) => c.url)).toEqual(["/api/cards/sync", "/api/cards/snapshot"]);
    expect(calls[0].body.reviews).toHaveLength(2);
    expect((await store.getCards()).map((c) => c.de)).toEqual(["Katze"]);
    expect(card).toBeDefined();
  });

  it("without refresh it only flushes (used during a review session)", async () => {
    await withQueue(1);
    const { fetchFn, calls } = server(snapshotOf([]));
    expect(await syncNow(store, { userId: "u1", refresh: false, fetchFn })).toEqual({ status: "synced", pending: 0, refreshed: false });
    expect(calls.map((c) => c.url)).toEqual(["/api/cards/sync"]);
  });

  it("offline: keeps every review and reports it", async () => {
    await withQueue(3);
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;
    expect(await syncNow(store, { userId: "u1", refresh: true, fetchFn })).toEqual({ status: "offline", pending: 3, refreshed: false });
    expect(await store.pendingCount()).toBe(3);
  });

  it.each([
    ["a server error", 500, "failed"],
    ["rate limiting", 429, "failed"],
    ["an expired login", 401, "signed-out"],
    ["a missing 2FA session", 403, "signed-out"],
  ] as const)("%s: keeps the reviews", async (_n, status, expected) => {
    await withQueue(2);
    const { fetchFn } = server(snapshotOf([]), { sync: () => json({ error: "x" }, status) });
    expect(await syncNow(store, { userId: "u1", refresh: true, fetchFn })).toEqual({ status: expected, pending: 2, refreshed: false });
  });

  it("keeps the reviews when the server answers with nonsense", async () => {
    await withQueue(1);
    const { fetchFn } = server(snapshotOf([]), { sync: () => json({ hello: "world" }) });
    expect((await syncNow(store, { userId: "u1", refresh: true, fetchFn })).pending).toBe(1);
  });

  it("removes only what the server acknowledged, and keeps going until the queue is empty", async () => {
    await withQueue(3);
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const { reviews } = JSON.parse(String(init?.body ?? "{}"));
      return json({ acknowledged: [reviews[0].id], cards: [] } satisfies SyncResponse);
    }) as unknown as typeof fetch;
    const out = await syncNow(store, { userId: "u1", refresh: false, fetchFn });
    expect(out).toEqual({ status: "synced", pending: 0, refreshed: false });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("stops when the server acknowledges ids it was never sent", async () => {
    await withQueue(2);
    const { fetchFn } = server(snapshotOf([]), {
      sync: () => json({ acknowledged: ["33333333-3333-4333-8333-333333333333"], cards: [] } satisfies SyncResponse),
    });
    expect(await syncNow(store, { userId: "u1", refresh: false, fetchFn })).toMatchObject({ status: "failed", pending: 2 });
  });

  it("does not loop forever when the server acknowledges nothing", async () => {
    await withQueue(1);
    const { fetchFn } = server(snapshotOf([]), { sync: () => json({ acknowledged: [], cards: [] } satisfies SyncResponse) });
    expect(await syncNow(store, { userId: "u1", refresh: true, fetchFn })).toMatchObject({ status: "failed", pending: 1 });
  });

  it("splits a long queue into batches of at most 500", async () => {
    const card = seenCard("2026-10-20T08:00:00Z");
    await store.replaceSnapshot("u1", snapshotOf([card]), NOW);
    for (let i = 0; i < 1100; i++) await store.recordReview(card.id, "good", 1, new Date(NOW.getTime() + i * 1000));
    const { fetchFn, calls } = server(snapshotOf([]));
    await syncNow(store, { userId: "u1", refresh: false, fetchFn });
    expect(calls.map((c) => c.body.reviews!.length)).toEqual([500, 500, 100]);
  });

  it("never sends the same review twice once it has been acknowledged", async () => {
    await withQueue(2);
    const { fetchFn, calls } = server(snapshotOf([]));
    await syncNow(store, { userId: "u1", refresh: false, fetchFn });
    await syncNow(store, { userId: "u1", refresh: false, fetchFn });
    expect(calls).toHaveLength(1);
  });

  it("runs one sync at a time but does not lose a request that arrives during it", async () => {
    await withQueue(1);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const seen: number[] = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (url === "/api/cards/sync") {
        seen.push(body.reviews.length);
        await gate;
        return json({ acknowledged: body.reviews.map((r: { id: string }) => r.id), cards: [] });
      }
      return json(snapshotOf([]));
    }) as unknown as typeof fetch;

    const first = syncNow(store, { userId: "u1", refresh: false, fetchFn });
    const lateCard = (await store.getCards())[0];
    await store.recordReview(lateCard.id, "easy", 1, new Date(NOW.getTime() + 5000)); // answered mid-sync
    const second = syncNow(store, { userId: "u1", refresh: false, fetchFn });
    release();
    await Promise.all([first, second]);
    expect(await store.pendingCount()).toBe(0);
    expect(seen.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("another account's leftovers are wiped, not uploaded", async () => {
    await withQueue(2);
    const { fetchFn, calls } = server(snapshotOf([]));
    await syncNow(store, { userId: "someone-else", refresh: false, fetchFn });
    expect(calls).toHaveLength(0);
    expect(await store.pendingCount()).toBe(0);
  });
});
