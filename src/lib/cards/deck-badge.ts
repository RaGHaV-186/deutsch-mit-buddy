import { safeTimeZone } from "@/lib/time";
import { openStore } from "./offline-store";
import { buildQueue } from "./queue";

/** Fired (on `window`) whenever the deck on this device was reloaded after a review or a sync, so the Cards badge can follow. */
export const DECK_CHANGED_EVENT = "buddy:deck-changed";

export function announceDeckChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DECK_CHANGED_EVENT));
}

/**
 * The Cards badge: reviews due today plus the new cards still allowed today, counted from the deck on this device (nothing is asked
 * of the server). 0 when this device has no deck yet (it appears after the first time Cards is opened here) or storage is unavailable.
 */
export async function readDueBadge(userId: string, now = new Date(), dbName?: string): Promise<number> {
  const store = await openStore(dbName);
  try {
    const info = await store.info(userId, now);
    if (!info) return 0;
    const { counts } = buildQueue(await store.getCards(), {
      mode: "both",
      now,
      timezone: safeTimeZone(info.timezone),
      newToday: info.newToday,
    });
    return counts.due + counts.fresh;
  } finally {
    store.close();
  }
}
