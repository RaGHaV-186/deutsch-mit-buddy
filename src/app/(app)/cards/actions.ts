"use server";

import rawSeed from "@data/seed-cards.json";
import { requireAal2 } from "@/lib/auth/guard";
import { ensureLessonCards } from "@/lib/cards/ensure-unlocked";
import { importSeedDeck, setSeedPointer, type ImportResult } from "@/lib/cards/server";
import { getProfile } from "@/lib/profile";
import { limitError } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export type ImportState = { error?: string; result?: ImportResult & { pointerMoved: boolean; lessonCardsUnlocked: number } } | undefined;

/**
 * Admin only: gives the signed-in admin Raghav's seed deck, puts the pointer on Day 11 · Z9 (never backwards) and unlocks the cards of the
 * published lessons up to there (words he already owns are not added twice). Safe to press again; nothing is duplicated or reset.
 */
export async function importSeedDeckAction(): Promise<ImportState> {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  if (profile?.role !== "admin") return { error: "forbidden" };
  const blocked = await limitError(`seed-import:${userId}`, 3, 3600);
  if (blocked) return { error: blocked };
  try {
    const db = createAdminClient();
    const now = new Date();
    const result = await importSeedDeck(db, userId, rawSeed, now);
    const { moved } = await setSeedPointer(db, userId);
    const unlocked = await ensureLessonCards(userId, now);
    return { result: { ...result, pointerMoved: moved, lessonCardsUnlocked: unlocked?.unlocked ?? 0 } };
  } catch (err) {
    console.error("seed import failed", { message: (err as Error).message });
    return { error: "generic" };
  }
}
