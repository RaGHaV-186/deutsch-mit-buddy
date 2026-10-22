import { indexOfCode, SESSIONS } from "@data/curriculum";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SrsState } from "@/lib/srs";
import { planImportSchedule } from "./schedule-plan";

// Unlocking a lesson's cards: the word and phrase templates of every PUBLISHED lesson up to the learner's current lesson are copied into
// their deck (source "lesson", with template_id). Lessons before the learner's starting lesson count as already seen and are spread over
// days; the starting lesson and everything after it is new. A card the learner already owns (same kind and German, from any source:
// Raghav's seed deck, an earlier lesson) is never added a second time.

export interface TemplateRow {
  id: string;
  session_code: string;
  kind: "word" | "say" | "answer";
  tier: "core" | "bonus";
  position: number;
  en: string;
  article: string | null;
  de: string;
  plural: string | null;
  example: string | null;
  example_en: string | null;
  tip: string | null;
}

export interface OwnedCard {
  kind: string;
  de: string;
}

/** What "the same card" means for a learner: the same kind of card for the same German word or sentence (case and spaces ignored). */
export const cardKey = (kind: string, de: string) => `${kind}\u0000${de.trim().toLowerCase()}`;

export interface PlannedUnlock {
  template: TemplateRow & { seq: number };
  seen: boolean;
  srs: SrsState;
}

export interface UnlockPlan {
  cards: PlannedUnlock[];
  /** Templates left out because the learner owns the card already (or an earlier template of this batch has it). */
  skipped: number;
}

/** Pure: which templates become cards now, and with what schedule. `templates` may come in any order. */
export function planUnlock(templates: TemplateRow[], owned: OwnedCard[], options: { startSeq: number; today: Date }): UnlockPlan {
  const taken = new Set(owned.map((c) => cardKey(c.kind, c.de)));
  const ordered = templates
    .map((t) => ({ ...t, seq: indexOfCode(t.session_code) }))
    .filter((t) => t.seq >= 0)
    // lesson order, then the words (core before bonus, in lesson order), then the phrases
    .sort((a, b) => a.seq - b.seq || (a.kind === b.kind ? 0 : a.kind === "word" ? -1 : 1) || a.position - b.position);
  let skipped = 0;
  const fresh: (TemplateRow & { seq: number })[] = [];
  for (const t of ordered) {
    const key = cardKey(t.kind, t.de);
    if (taken.has(key)) {
      skipped++;
      continue;
    }
    taken.add(key);
    fresh.push(t);
  }
  const plan = planImportSchedule(fresh, { startSeq: options.startSeq, today: options.today });
  return { cards: plan.map(({ card, seen, srs }) => ({ template: card, seen, srs })), skipped };
}

export interface UnlockResult {
  unlocked: number;
  skipped: number;
  /** The highest published lesson now unlocked (curriculum index), or null when nothing was published yet. */
  throughSeq: number | null;
}

const PAGE = 1000;
const TEMPLATE_COLUMNS = "id, session_code, kind, tier, position, en, article, de, plural, example, example_en, tip";

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`${what}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/**
 * Copies the cards of the published lessons up to `targetSeq` that the learner does not have yet. Idempotent and safe when two screens
 * load at once (the second insert hits the unique index and is skipped). Uses the service role: pass the verified user's id.
 * `unlockedSeq` is the profile's deck_unlocked_seq; the profile is updated here.
 */
export async function unlockLessonCards(
  db: SupabaseClient,
  userId: string,
  options: { startSeq: number; targetSeq: number; unlockedSeq: number | null; now: Date },
): Promise<UnlockResult> {
  const lessonSeqs = new Map<string, number>(SESSIONS.flatMap((s, seq) => (s.kind === "lesson" && seq <= options.targetSeq ? [[s.code, seq] as [string, number]] : [])));

  const published = await db.from("lesson_publications").select("session_code").limit(1000);
  if (published.error) throw new Error(`Reading published lessons: ${published.error.message}`);
  const newlyPublished = (published.data ?? [])
    .map((r) => r.session_code as string)
    .filter((code) => lessonSeqs.has(code) && lessonSeqs.get(code)! > (options.unlockedSeq ?? -1));
  if (newlyPublished.length === 0) return { unlocked: 0, skipped: 0, throughSeq: options.unlockedSeq };

  const templates = await fetchAll<TemplateRow>(
    (from, to) => db.from("card_templates").select(TEMPLATE_COLUMNS).in("session_code", newlyPublished).order("id").range(from, to),
    "Reading card templates",
  );
  const owned = await fetchAll<OwnedCard>((from, to) => db.from("cards").select("kind, de").eq("user_id", userId).order("id").range(from, to), "Reading the deck");

  const plan = planUnlock(templates, owned, { startSeq: options.startSeq, today: options.now });
  const throughSeq = Math.max(...newlyPublished.map((c) => lessonSeqs.get(c)!));
  let unlocked = 0;

  for (let i = 0; i < plan.cards.length; i += 100) {
    const batch = plan.cards.slice(i, i + 100);
    const inserted = await db
      .from("cards")
      .insert(
        batch.map(({ template: t }, j) => ({
          user_id: userId,
          kind: t.kind,
          en: t.en,
          article: t.article,
          de: t.de,
          plural: t.plural,
          example: t.example,
          example_en: t.example_en,
          tip: t.tip,
          session_code: t.session_code,
          source: "lesson",
          template_id: t.id,
          // Keeps the lesson order when new cards are introduced.
          created_at: new Date(options.now.getTime() + (i + j) * 1000 - plan.cards.length * 1000).toISOString(),
        })),
      )
      .select("id, template_id");
    // Another request unlocked the same lessons a moment ago: nothing left to do for this batch.
    if (inserted.error?.code === "23505") continue;
    if (inserted.error) throw new Error(`Unlocking cards: ${inserted.error.message}`);

    const idOf = new Map((inserted.data ?? []).map((r) => [r.template_id as string, r.id as string]));
    const srsRows = batch.map(({ template, srs }) => ({
      card_id: idOf.get(template.id)!,
      user_id: userId,
      due_at: srs.dueAt,
      interval_days: srs.intervalDays,
      ease: srs.ease,
      reps: srs.reps,
      lapses: srs.lapses,
      last_reviewed_at: srs.lastReviewedAt,
    }));
    const scheduled = await db.from("card_srs").upsert(srsRows, { onConflict: "card_id", ignoreDuplicates: true });
    if (scheduled.error) throw new Error(`Scheduling unlocked cards: ${scheduled.error.message}`);
    unlocked += batch.length;
  }

  const marked = await db.from("profiles").update({ deck_unlocked_seq: throughSeq }).eq("user_id", userId);
  if (marked.error) throw new Error(`Saving the unlock point: ${marked.error.message}`);
  return { unlocked, skipped: plan.skipped, throughSeq };
}

/** The learner's starting lesson as a curriculum index: the picked start (start_code), else the current lesson. */
export function startSeqOf(profile: { start_code: string | null; session_seq: number }): number {
  const fromCode = profile.start_code ? indexOfCode(profile.start_code) : -1;
  return fromCode >= 0 ? fromCode : profile.session_seq;
}

/** Reads the learner's profile and unlocks what is new. Returns null before onboarding (no pointer yet). */
export async function unlockForUser(db: SupabaseClient, userId: string, now: Date): Promise<UnlockResult | null> {
  const { data, error } = await db.from("profiles").select("start_code, session_seq, onboarded_at, deck_unlocked_seq").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Reading the profile: ${error.message}`);
  if (!data?.onboarded_at) return null;
  return unlockLessonCards(db, userId, { startSeq: startSeqOf(data), targetSeq: data.session_seq, unlockedSeq: data.deck_unlocked_seq, now });
}
