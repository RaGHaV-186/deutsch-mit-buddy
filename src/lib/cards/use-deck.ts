"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Grade } from "@/lib/srs";
import { openStore, type DeckInfo, type OfflineStore } from "./offline-store";
import type { SnapshotCard } from "./schema";
import { syncNow, type SyncStatus } from "./sync";

export type SyncUi = SyncStatus | "syncing";
const FLUSH_DELAY_MS = 3000;

export interface DeckState {
  /** loading: reading this device; ready: cards (maybe none) are available; no-storage: IndexedDB can't be used. */
  status: "loading" | "ready" | "no-storage";
  cards: SnapshotCard[];
  info: DeckInfo | null;
  /** Reviews on this phone that the server doesn't have yet. */
  pending: number;
  sync: SyncUi;
  /** True once the first sync attempt after opening has finished (success or not). */
  firstSyncDone: boolean;
}

const initial: DeckState = { status: "loading", cards: [], info: null, pending: 0, sync: "syncing", firstSyncDone: false };

/**
 * The learner's deck on this device. Reads and writes go to IndexedDB first, then sync in the background:
 * on open, when the connection returns, when the app comes back to the foreground, and shortly after each answer.
 * While `reviewing`, syncs only send reviews and don't swap the deck under the session.
 */
export function useDeck(userId: string, reviewing: boolean) {
  const [state, setState] = useState<DeckState>(initial);
  const storeRef = useRef<OfflineStore | null>(null);
  const reviewingRef = useRef(reviewing);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    reviewingRef.current = reviewing;
  }, [reviewing]);

  const reload = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const [cards, info, pending] = await Promise.all([store.getCards(), store.info(userId, new Date()), store.pendingCount()]);
    setState((s) => ({ ...s, status: "ready", cards: info ? cards : [], info, pending }));
  }, [userId]);

  const sync = useCallback(
    async (refresh: boolean) => {
      const store = storeRef.current;
      if (!store) return;
      if (!navigator.onLine) {
        // Don't wait for a request to fail: the reviews stay on the phone.
        setState((s) => ({ ...s, sync: "offline", firstSyncDone: true }));
        return;
      }
      setState((s) => ({ ...s, sync: "syncing" }));
      const outcome = await syncNow(store, { userId, refresh });
      await reload();
      setState((s) => ({ ...s, sync: outcome.status, pending: outcome.pending, firstSyncDone: true }));
    },
    [userId, reload],
  );

  useEffect(() => {
    let cancelled = false;
    let store: OfflineStore | null = null;
    const syncIfOnline = () => void sync(!reviewingRef.current);
    const onVisible = () => {
      if (document.visibilityState === "visible") syncIfOnline();
    };

    (async () => {
      try {
        store = await openStore();
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: "no-storage", firstSyncDone: true }));
        return;
      }
      if (cancelled) {
        store.close();
        return;
      }
      storeRef.current = store;
      await reload();
      await sync(true);
    })();

    window.addEventListener("online", syncIfOnline);
    window.addEventListener("offline", () => setState((s) => ({ ...s, sync: "offline" })));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("online", syncIfOnline);
      document.removeEventListener("visibilitychange", onVisible);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      storeRef.current = null;
      store?.close();
    };
  }, [reload, sync]);

  /** Saves an answer on this device (before anything else) and queues a background sync. Resolves with the updated card. */
  const answer = useCallback(
    async (card: SnapshotCard, grade: Grade, msTaken: number): Promise<SnapshotCard> => {
      const store = storeRef.current;
      if (!store) throw new Error("Deck not ready");
      const updated = await store.recordReview(card.id, grade, msTaken, new Date());
      setState((s) => ({ ...s, cards: s.cards.map((c) => (c.id === updated.id ? updated : c)), pending: s.pending + 1 }));
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        void sync(false);
      }, FLUSH_DELAY_MS);
      return updated;
    },
    [sync],
  );

  return { ...state, answer, reload, syncDeck: sync };
}
