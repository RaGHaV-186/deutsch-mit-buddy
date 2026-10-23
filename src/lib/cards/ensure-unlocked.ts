import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/profile";
import { newLessonCodes, unlockForUser, type UnlockResult } from "./unlock";

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

const PUBLISHED_TTL_MS = 60_000;
let publishedCache: { at: number; codes: string[] } | null = null;

/** Which lessons are published, remembered for a minute per server instance (it changes only when a lesson is released). Null when it could not be read. */
async function publishedCodes(): Promise<string[] | null> {
  if (publishedCache && Date.now() - publishedCache.at < PUBLISHED_TTL_MS) return publishedCache.codes;
  try {
    const { data, error } = await createAdminClient().from("lesson_publications").select("session_code").limit(1000);
    if (error) throw error;
    publishedCache = { at: Date.now(), codes: (data ?? []).map((r) => r.session_code as string) };
    return publishedCache.codes;
  } catch {
    return null;
  }
}

/** For the screens that count cards: the full unlock above, but only when a published lesson is waiting. Normally no database call at all. */
export async function ensureLessonCardsIfNew(
  userId: string,
  profile: Pick<Profile, "onboarded_at" | "session_seq" | "deck_unlocked_seq">,
): Promise<void> {
  if (!profile.onboarded_at) return;
  const codes = await publishedCodes();
  if (codes && newLessonCodes(codes, { targetSeq: profile.session_seq, unlockedSeq: profile.deck_unlocked_seq }).length === 0) return;
  await ensureLessonCards(userId);
}

/** Tests only: forget the remembered list of published lessons. */
export function resetPublishedCache() {
  publishedCache = null;
}
