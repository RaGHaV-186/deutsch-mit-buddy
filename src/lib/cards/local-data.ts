import { openStore } from "./offline-store";
import { syncNow } from "./sync";

export type ClearResult = "cleared" | "kept-unsynced";

/**
 * For sign-out on a shared phone: forgets the saved pages and the deck on this device.
 * Reviews that could not be sent are never thrown away: it tries to send them first, and if they are still waiting
 * (no connection) it keeps the deck. It stays hidden from other accounts, and is sent after the next login.
 */
export async function clearOfflineData(): Promise<ClearResult> {
  try {
    if ("caches" in globalThis) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("buddy-")).map((n) => caches.delete(n)));
    }
  } catch {
    // Nothing to clear.
  }

  let store;
  try {
    store = await openStore();
  } catch {
    return "cleared";
  }
  try {
    if ((await store.pendingCount()) > 0 && navigator.onLine) {
      const userId = await store.currentUserId();
      if (userId) await syncNow(store, { userId, refresh: false });
    }
    if ((await store.pendingCount()) > 0) return "kept-unsynced";
    await store.clear();
    return "cleared";
  } catch {
    return "kept-unsynced";
  } finally {
    store.close();
  }
}
