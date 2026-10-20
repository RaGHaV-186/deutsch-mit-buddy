import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOfflineData } from "./local-data";
import { openStore } from "./offline-store";
import { makeCard, seenCard } from "./test-helpers";

const NOW = new Date();
const deleted: string[] = [];

async function deviceWithReviews(n: number) {
  const store = await openStore();
  const cards = Array.from({ length: Math.max(n, 1) }, () => seenCard(new Date(NOW.getTime() - 1000).toISOString()));
  await store.replaceSnapshot("u1", { now: NOW.toISOString(), timezone: "Europe/Berlin", newToday: 0, cards }, NOW);
  for (const c of cards.slice(0, n)) await store.recordReview(c.id, "good", 1, NOW);
  store.close();
}
const setOnline = (v: boolean) => Object.defineProperty(window.navigator, "onLine", { value: v, configurable: true });

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  deleted.length = 0;
  vi.stubGlobal("caches", {
    keys: async () => ["buddy-pages-v1", "buddy-static-v1", "other-app"],
    delete: async (n: string) => deleted.push(n),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setOnline(true);
});

describe("clearOfflineData (sign-out)", () => {
  it("removes the saved pages and the deck when everything is synced", async () => {
    await deviceWithReviews(0);
    expect(await clearOfflineData()).toBe("cleared");
    expect(deleted).toEqual(["buddy-pages-v1", "buddy-static-v1"]); // not other apps' caches
    const store = await openStore();
    expect(await store.getCards()).toEqual([]);
  });

  it("sends waiting reviews first, then clears", async () => {
    await deviceWithReviews(2);
    setOnline(true);
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      const { reviews } = JSON.parse(String(init?.body));
      return Response.json({ acknowledged: reviews.map((r: { id: string }) => r.id), cards: [] });
    }));
    expect(await clearOfflineData()).toBe("cleared");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the deck when reviews are still waiting and cannot be sent (offline)", async () => {
    await deviceWithReviews(2);
    setOnline(false);
    expect(await clearOfflineData()).toBe("kept-unsynced");
    const store = await openStore();
    expect(await store.pendingCount()).toBe(2);
    expect(deleted).toContain("buddy-pages-v1"); // the saved pages still go
  });

  it("keeps the deck when the server refuses the reviews", async () => {
    await deviceWithReviews(1);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    expect(await clearOfflineData()).toBe("kept-unsynced");
    expect(await (await openStore()).pendingCount()).toBe(1);
  });

  it("does nothing harmful when there is no deck at all", async () => {
    expect(await clearOfflineData()).toBe("cleared");
    expect(makeCard()).toBeDefined();
  });
});
