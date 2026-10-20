"use server";

import rawSeed from "@data/seed-cards.json";
import { requireAal2 } from "@/lib/auth/guard";
import { importSeedDeck, type ImportResult } from "@/lib/cards/server";
import { getProfile } from "@/lib/profile";
import { limitError } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export type ImportState = { error?: string; result?: ImportResult } | undefined;

/** Admin only: gives the signed-in admin Raghav's seed deck. Safe to press again; nothing is duplicated or reset. */
export async function importSeedDeckAction(): Promise<ImportState> {
  const { userId } = await requireAal2();
  const profile = await getProfile(userId);
  if (profile?.role !== "admin") return { error: "forbidden" };
  const blocked = await limitError(`seed-import:${userId}`, 3, 3600);
  if (blocked) return { error: blocked };
  try {
    return { result: await importSeedDeck(createAdminClient(), userId, rawSeed, new Date()) };
  } catch (err) {
    console.error("seed import failed", { message: (err as Error).message });
    return { error: "generic" };
  }
}
