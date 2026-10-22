import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { unlockForUser, type UnlockResult } from "./unlock";

async function run(userId: string, now: Date): Promise<UnlockResult | null> {
  try {
    return await unlockForUser(createAdminClient(), userId, now);
  } catch (err) {
    console.error("lesson card unlock failed", { message: (err as Error).message });
    return null;
  }
}

/** One unlock per request, shared by everyone who asks: the layout and the page render at the same time and both must wait for it. */
const oncePerRequest = cache((userId: string) => run(userId, new Date()));

/**
 * Makes sure the learner's deck holds the cards of every published lesson up to today's lesson. Cheap when nothing is new (one read of
 * the published lessons). Never throws: a failed unlock must not break the screen that asked for it.
 *
 * Await it BEFORE reading card counts. In a page or layout call it without `now`: the layout and the page render in parallel, and the
 * shared per-request promise is what keeps the page from counting cards before they exist.
 */
export function ensureLessonCards(userId: string, now?: Date): Promise<UnlockResult | null> {
  return now ? run(userId, now) : oncePerRequest(userId);
}
