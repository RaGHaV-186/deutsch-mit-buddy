import { MAX_SYNC_EVENTS, snapshotResponseSchema, syncResponseSchema } from "./schema";
import type { OfflineStore } from "./offline-store";

export type SyncStatus =
  /** Everything this device did is on the server. */
  | "synced"
  /** No connection; reviews stay on the phone and go out later. */
  | "offline"
  /** The server answered with an error or something unexpected; will retry. */
  | "failed"
  /** The login has expired; sign in again to sync. */
  | "signed-out";

export interface SyncOutcome {
  status: SyncStatus;
  /** Reviews still waiting on this device. */
  pending: number;
  /** True when a fresh snapshot of the deck was stored. */
  refreshed: boolean;
}

export interface SyncOptions {
  userId: string;
  /** Also download a fresh snapshot after the queue is empty. Skip while someone is mid-session. */
  refresh: boolean;
  now?: () => Date;
  fetchFn?: typeof fetch;
}

async function post(fetchFn: typeof fetch, url: string, body: unknown) {
  return fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
}

const isNetworkError = (err: unknown) => err instanceof TypeError;

async function run(store: OfflineStore, options: SyncOptions): Promise<SyncOutcome> {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? (() => new Date());
  const outcome = async (status: SyncStatus, refreshed = false): Promise<SyncOutcome> => ({
    status,
    pending: await store.pendingCount(),
    refreshed,
  });

  await store.claimFor(options.userId);

  try {
    // 1. Send what happened on this phone. Events leave the queue only once the server has acknowledged them.
    for (;;) {
      const batch = (await store.getQueue()).slice(0, MAX_SYNC_EVENTS);
      if (batch.length === 0) break;
      const res = await post(fetchFn, "/api/cards/sync", { reviews: batch });
      if (res.status === 401 || res.status === 403) return outcome("signed-out");
      if (!res.ok) return outcome("failed");
      const parsed = syncResponseSchema.safeParse(await res.json());
      if (!parsed.success) return outcome("failed");
      await store.removeFromQueue(parsed.data.acknowledged);
      await store.applyServerCards(parsed.data.cards);
      // A server that acknowledges nothing from this batch would make us send it forever.
      const sent = new Set(batch.map((e) => e.id));
      if (!parsed.data.acknowledged.some((id) => sent.has(id))) return outcome("failed");
    }

    // 2. Everything is synced: refresh the deck so tomorrow's cards are on the phone too.
    if (!options.refresh) return outcome("synced");
    const res = await post(fetchFn, "/api/cards/snapshot", {});
    if (res.status === 401 || res.status === 403) return outcome("signed-out");
    if (!res.ok) return outcome("failed");
    const parsed = snapshotResponseSchema.safeParse(await res.json());
    if (!parsed.success) return outcome("failed");
    // Answers given while the snapshot was downloading must not be overwritten by it.
    if ((await store.pendingCount()) > 0) return outcome("synced");
    await store.replaceSnapshot(options.userId, parsed.data, now());
    return outcome("synced", true);
  } catch (err) {
    return outcome(isNetworkError(err) ? "offline" : "failed");
  }
}

let current: Promise<SyncOutcome> | null = null;
let rerun: SyncOptions | null = null;

/**
 * Syncs once at a time. A request that arrives while a sync is running is not lost: it runs right after
 * (so a review answered during a sync still goes out), and every caller gets the final result.
 */
export function syncNow(store: OfflineStore, options: SyncOptions): Promise<SyncOutcome> {
  if (current) {
    rerun = { ...options, refresh: options.refresh || (rerun?.refresh ?? false) };
    return current;
  }
  current = (async () => {
    let result = await run(store, options);
    while (rerun) {
      const next = rerun;
      rerun = null;
      result = await run(store, next);
    }
    return result;
  })().finally(() => {
    current = null;
  });
  return current;
}
