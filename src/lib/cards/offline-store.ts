import { foldReviews, isNewCard, schedule, type Grade } from "@/lib/srs";
import { localDayKey } from "@/lib/time";
import type { ReviewEventInput, SnapshotCard, SnapshotResponse, SyncResponse } from "./schema";

// The deck on this device, in IndexedDB: the cards with their schedules, the reviews waiting to sync, and a little metadata.
// Every review is written here first (one transaction), so nothing is lost if the connection or the app drops.

export const DB_NAME = "buddy-cards";
const DB_VERSION = 1;

interface Meta {
  key: "state";
  userId: string;
  timezone: string;
  /** ISO time of the last snapshot taken from the server. */
  snapshotAt: string;
  /** New cards started today (local day) on this device or already synced. */
  newToday: { day: string; count: number };
}

export interface DeckInfo {
  userId: string;
  timezone: string;
  snapshotAt: string;
  newToday: number;
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

export function openDb(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("meta", { keyPath: "key" });
      db.createObjectStore("cards", { keyPath: "id" });
      db.createObjectStore("queue", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Database upgrade blocked"));
  });
}

export function deleteDb(name = DB_NAME): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

export class OfflineStore {
  constructor(private readonly db: IDBDatabase) {}

  close() {
    this.db.close();
  }

  private async meta(): Promise<Meta | null> {
    const tx = this.db.transaction("meta", "readonly");
    return ((await wrap(tx.objectStore("meta").get("state"))) as Meta | undefined) ?? null;
  }

  /** What is stored, or null when this device has no deck (or the deck belongs to another account). */
  async info(userId: string, now: Date): Promise<DeckInfo | null> {
    const meta = await this.meta();
    if (!meta || meta.userId !== userId) return null;
    const today = localDayKey(now, meta.timezone);
    return {
      userId: meta.userId,
      timezone: meta.timezone,
      snapshotAt: meta.snapshotAt,
      newToday: meta.newToday.day === today ? meta.newToday.count : 0,
    };
  }

  async getCards(): Promise<SnapshotCard[]> {
    const tx = this.db.transaction("cards", "readonly");
    return (await wrap(tx.objectStore("cards").getAll())) as SnapshotCard[];
  }

  async getQueue(): Promise<ReviewEventInput[]> {
    const tx = this.db.transaction("queue", "readonly");
    const all = (await wrap(tx.objectStore("queue").getAll())) as ReviewEventInput[];
    return all.sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.id.localeCompare(b.id));
  }

  async pendingCount(): Promise<number> {
    const tx = this.db.transaction("queue", "readonly");
    return wrap(tx.objectStore("queue").count());
  }

  /**
   * Stores the answer and the card's new schedule in one transaction (nothing half-saved), and returns the updated card.
   * `at` is the device time; the server decides later whether the answer is the latest one for that card.
   */
  async recordReview(
    cardId: string,
    grade: Grade,
    msTaken: number,
    at: Date,
    eventId: string = crypto.randomUUID(),
  ): Promise<SnapshotCard> {
    const tx = this.db.transaction(["cards", "queue", "meta"], "readwrite");
    const cards = tx.objectStore("cards");
    const card = (await wrap(cards.get(cardId))) as SnapshotCard | undefined;
    if (!card) {
      tx.abort();
      throw new Error("Card not found on this device");
    }
    const wasNew = isNewCard(card.srs);
    const updated: SnapshotCard = { ...card, srs: schedule(card.srs, grade, at) };
    cards.put(updated);
    tx.objectStore("queue").put({
      id: eventId,
      cardId,
      grade,
      reviewedAt: at.toISOString(),
      msTaken: Math.min(600_000, Math.max(0, Math.round(msTaken))),
    } satisfies ReviewEventInput);

    if (wasNew) {
      const metaStore = tx.objectStore("meta");
      const meta = (await wrap(metaStore.get("state"))) as Meta | undefined;
      if (meta) {
        const today = localDayKey(at, meta.timezone);
        const count = meta.newToday.day === today ? meta.newToday.count + 1 : 1;
        metaStore.put({ ...meta, newToday: { day: today, count } });
      }
    }
    await done(tx);
    return updated;
  }

  /** Forget events the server has recorded. */
  async removeFromQueue(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const tx = this.db.transaction("queue", "readwrite");
    const queue = tx.objectStore("queue");
    for (const id of ids) queue.delete(id);
    await done(tx);
  }

  /**
   * Takes the server's schedules for cards it just updated. Answers given since the sync started (still in the queue)
   * are applied on top, so the phone never goes backwards.
   */
  async applyServerCards(updates: SyncResponse["cards"]): Promise<void> {
    if (updates.length === 0) return;
    const tx = this.db.transaction(["cards", "queue"], "readwrite");
    const cards = tx.objectStore("cards");
    const pending = (await wrap(tx.objectStore("queue").getAll())) as ReviewEventInput[];
    for (const update of updates) {
      const card = (await wrap(cards.get(update.id))) as SnapshotCard | undefined;
      if (!card) continue;
      const later = pending.filter((e) => e.cardId === update.id);
      const srs = later.length > 0 ? foldReviews(update.srs, later).state : update.srs;
      cards.put({ ...card, srs });
    }
    await done(tx);
  }

  /**
   * Replaces the deck with a fresh snapshot. Call only when the queue is empty (everything synced); a different
   * account's data is replaced entirely.
   */
  async replaceSnapshot(userId: string, snapshot: SnapshotResponse, now: Date): Promise<void> {
    const tx = this.db.transaction(["cards", "queue", "meta"], "readwrite");
    const cards = tx.objectStore("cards");
    cards.clear();
    for (const card of snapshot.cards) cards.put(card);
    tx.objectStore("meta").put({
      key: "state",
      userId,
      timezone: snapshot.timezone,
      snapshotAt: snapshot.now,
      newToday: { day: localDayKey(now, snapshot.timezone), count: snapshot.newToday },
    } satisfies Meta);
    await done(tx);
  }

  /** Makes the stored deck belong to `userId`: anything left by another account is wiped first. */
  async claimFor(userId: string): Promise<void> {
    const meta = await this.meta();
    if (meta && meta.userId !== userId) await this.clear();
  }

  /** Wipes everything (sign-out, or a different account on a shared phone). */
  async clear(): Promise<void> {
    const tx = this.db.transaction(["cards", "queue", "meta"], "readwrite");
    for (const name of ["cards", "queue", "meta"]) tx.objectStore(name).clear();
    await done(tx);
  }
}

export async function openStore(name = DB_NAME): Promise<OfflineStore> {
  return new OfflineStore(await openDb(name));
}
