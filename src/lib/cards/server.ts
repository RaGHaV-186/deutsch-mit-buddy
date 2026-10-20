import type { SupabaseClient } from "@supabase/supabase-js";
import { foldReviews, type SrsState } from "@/lib/srs";
import { startOfLocalDay, startOfNextLocalDay } from "@/lib/time";
import { DAILY_NEW_LIMIT } from "./queue";
import { planImportSchedule } from "./schedule-plan";
import { snapshotCardSchema, type ReviewEventInput, type SnapshotCard, type SnapshotResponse, type SyncResponse } from "./schema";
import { parseSeedDeck, seedStartSeq } from "./seed";

// Server-side card logic. Every function takes the Supabase client to use, so the route decides the privilege:
// reads use the member's own session (row-level security applies), writes use the service role and are always
// scoped to the verified `userId` passed in.

const MAX_SNAPSHOT_DUE = 300;
/** A phone with a wrong clock must not strand its reviews in the queue forever. */
const FUTURE_GRACE_MS = 5 * 60_000;
const CAS_RETRIES = 3;

const CARD_COLUMNS = "id, kind, en, article, de, plural, example, example_en, tip, session_code, created_at";
const SRS_COLUMNS = "due_at, interval_days, ease, reps, lapses, last_reviewed_at";

interface SrsRow {
  due_at: string;
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
  last_reviewed_at: string | null;
}

const srsFromRow = (r: SrsRow): SrsState => ({
  dueAt: new Date(r.due_at).toISOString(),
  intervalDays: r.interval_days,
  ease: r.ease,
  reps: r.reps,
  lapses: r.lapses,
  lastReviewedAt: r.last_reviewed_at ? new Date(r.last_reviewed_at).toISOString() : null,
});

const srsToRow = (s: SrsState) => ({
  due_at: s.dueAt,
  interval_days: s.intervalDays,
  ease: s.ease,
  reps: s.reps,
  lapses: s.lapses,
  last_reviewed_at: s.lastReviewedAt,
});

interface CardRow {
  id: string;
  kind: string;
  en: string;
  article: string | null;
  de: string;
  plural: string | null;
  example: string | null;
  example_en: string | null;
  tip: string | null;
  session_code: string | null;
  created_at: string;
}

/** PostgREST returns a one-to-one embed as an object (some versions as a one-element array). */
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function toSnapshotCard(card: CardRow, srs: SrsRow): SnapshotCard {
  return snapshotCardSchema.parse({
    id: card.id,
    kind: card.kind,
    en: card.en,
    article: card.article,
    de: card.de,
    plural: card.plural,
    example: card.example,
    exampleEn: card.example_en,
    tip: card.tip,
    sessionCode: card.session_code,
    createdAt: new Date(card.created_at).toISOString(),
    srs: srsFromRow(srs),
  });
}

function fail(what: string, error: { message?: string; code?: string } | null): never {
  throw new Error(`${what} failed${error?.code ? ` (${error.code})` : ""}`);
}

/**
 * Everything the phone needs to review offline: cards due before the end of tomorrow (so the next day also works
 * without a connection) plus the first new cards of each mode, and how many new cards were already started today.
 */
export async function getSnapshot(db: SupabaseClient, userId: string, now: Date, timezone: string): Promise<SnapshotResponse> {
  const horizon = startOfNextLocalDay(new Date(startOfNextLocalDay(now, timezone).getTime() + 1), timezone);
  const dayStart = startOfLocalDay(now, timezone);

  const [due, freshWords, freshSpeaking, startedToday] = await Promise.all([
    db
      .from("card_srs")
      .select(`${SRS_COLUMNS}, cards!inner(${CARD_COLUMNS})`)
      .eq("user_id", userId)
      .not("last_reviewed_at", "is", null)
      .lt("due_at", horizon.toISOString())
      .order("due_at")
      .limit(MAX_SNAPSHOT_DUE),
    freshQuery(db, userId, ["word"]),
    freshQuery(db, userId, ["say", "answer"]),
    db
      .from("reviews")
      .select("card_id")
      .eq("user_id", userId)
      .eq("was_new", true)
      .eq("applied", true)
      .gte("reviewed_at", dayStart.toISOString())
      .limit(1000),
  ]);
  if (due.error) fail("Loading due cards", due.error);
  if (freshWords.error) fail("Loading new cards", freshWords.error);
  if (freshSpeaking.error) fail("Loading new cards", freshSpeaking.error);
  if (startedToday.error) fail("Counting new cards", startedToday.error);

  const cards: SnapshotCard[] = [];
  for (const row of (due.data ?? []) as unknown as (SrsRow & { cards: CardRow | CardRow[] })[]) {
    const card = one(row.cards);
    if (card) cards.push(toSnapshotCard(card, row));
  }
  for (const row of [...(freshWords.data ?? []), ...(freshSpeaking.data ?? [])] as unknown as (CardRow & {
    card_srs: SrsRow | SrsRow[];
  })[]) {
    const srs = one(row.card_srs);
    if (srs) cards.push(toSnapshotCard(row, srs));
  }

  return {
    now: now.toISOString(),
    timezone,
    newToday: new Set((startedToday.data ?? []).map((r) => r.card_id as string)).size,
    cards,
  };
}

function freshQuery(db: SupabaseClient, userId: string, kinds: string[]) {
  return db
    .from("cards")
    .select(`${CARD_COLUMNS}, card_srs!inner(${SRS_COLUMNS})`)
    .eq("user_id", userId)
    .in("kind", kinds)
    .is("card_srs.last_reviewed_at", null)
    .order("created_at")
    .limit(DAILY_NEW_LIMIT);
}

/**
 * Records answers from a device and updates the schedule. Safe to repeat: events are keyed by their device-made id.
 * "Latest review wins": per card, events are folded oldest first and one older than the card's last applied review is
 * stored (applied = false) without touching the schedule. Returns the authoritative schedule of every touched card.
 */
export async function applyReviews(
  db: SupabaseClient,
  userId: string,
  events: ReviewEventInput[],
  now: Date,
): Promise<SyncResponse> {
  const limit = now.getTime() + FUTURE_GRACE_MS;
  const clamped = events.map((e) => (Date.parse(e.reviewedAt) > limit ? { ...e, reviewedAt: now.toISOString() } : e));

  const cardIds = [...new Set(clamped.map((e) => e.cardId))];
  const eventIds = clamped.map((e) => e.id);

  const [owned, recorded] = await Promise.all([
    db.from("cards").select("id").eq("user_id", userId).in("id", cardIds),
    db.from("reviews").select("id").eq("user_id", userId).in("id", eventIds),
  ]);
  if (owned.error) fail("Checking cards", owned.error);
  if (recorded.error) fail("Checking reviews", recorded.error);
  const ownedIds = new Set((owned.data ?? []).map((r) => r.id as string));
  const alreadyRecorded = new Set((recorded.data ?? []).map((r) => r.id as string));

  // Unknown (deleted, or not this user's) cards and repeated events are acknowledged so the device can drop them.
  const todo = clamped.filter((e) => ownedIds.has(e.cardId) && !alreadyRecorded.has(e.id));
  const byCard = new Map<string, ReviewEventInput[]>();
  for (const e of todo) byCard.set(e.cardId, [...(byCard.get(e.cardId) ?? []), e]);

  const rows: Record<string, unknown>[] = [];
  const touched = new Map<string, SrsState>();

  const workCards = [...byCard.keys()];
  const states = await loadSrs(db, userId, workCards);

  for (let i = 0; i < workCards.length; i += 20) {
    await Promise.all(
      workCards.slice(i, i + 20).map(async (cardId) => {
        let state = states.get(cardId);
        if (!state) return;
        const cardEvents = byCard.get(cardId)!;
        for (let attempt = 0; attempt < CAS_RETRIES; attempt++) {
          const folded = foldReviews(state, cardEvents);
          const changed = folded.state.lastReviewedAt !== state.lastReviewedAt;
          // Compare-and-set on last_reviewed_at: if another device synced this card meanwhile, re-read and fold again.
          const swapped = changed ? await compareAndSet(db, userId, cardId, state.lastReviewedAt, folded.state) : true;
          if (swapped) {
            touched.set(cardId, folded.state);
            const byId = new Map(cardEvents.map((e) => [e.id, e]));
            for (const r of folded.results) {
              const e = byId.get(r.id)!;
              rows.push({
                id: e.id,
                user_id: userId,
                card_id: cardId,
                grade: e.grade,
                reviewed_at: e.reviewedAt,
                ms_taken: e.msTaken,
                applied: r.applied,
                was_new: r.wasNew,
              });
            }
            return;
          }
          const fresh = (await loadSrs(db, userId, [cardId])).get(cardId);
          if (!fresh) return;
          state = fresh;
        }
        throw new Error("Card schedule kept changing; try again");
      }),
    );
  }

  if (rows.length > 0) {
    const { error } = await db.from("reviews").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) fail("Saving reviews", error);
  }

  // Also return the current schedule of cards whose events were all repeats, so the device ends up in agreement.
  const settled = cardIds.filter((id) => ownedIds.has(id) && !touched.has(id));
  if (settled.length > 0) for (const [id, s] of await loadSrs(db, userId, settled)) touched.set(id, s);

  return {
    acknowledged: eventIds,
    cards: [...touched].map(([id, srs]) => ({ id, srs })),
  };
}

async function loadSrs(db: SupabaseClient, userId: string, cardIds: string[]) {
  const { data, error } = await db
    .from("card_srs")
    .select(`card_id, ${SRS_COLUMNS}`)
    .eq("user_id", userId)
    .in("card_id", cardIds);
  if (error) fail("Loading schedules", error);
  return new Map((data ?? []).map((r) => [r.card_id as string, srsFromRow(r as SrsRow)]));
}

async function compareAndSet(
  db: SupabaseClient,
  userId: string,
  cardId: string,
  expectedLast: string | null,
  next: SrsState,
): Promise<boolean> {
  let query = db.from("card_srs").update(srsToRow(next)).eq("card_id", cardId).eq("user_id", userId);
  query = expectedLast === null ? query.is("last_reviewed_at", null) : query.eq("last_reviewed_at", expectedLast);
  const { data, error } = await query.select("card_id");
  if (error) fail("Saving schedule", error);
  return (data ?? []).length > 0;
}

export interface ImportResult {
  imported: number;
  alreadyThere: number;
  duplicatesSkipped: number;
  /** Of the imported cards: already-seen (spread over days) and new. */
  seen: number;
  fresh: number;
}

/**
 * Gives `userId` Raghav's seed deck. Safe to run again: cards already imported are left alone, so progress is never reset.
 * Cards from before Z9 start as already seen and are spread over days; the Z9 cards start as new.
 */
export async function importSeedDeck(db: SupabaseClient, userId: string, rawSeed: unknown, now: Date): Promise<ImportResult> {
  const { cards, duplicates } = parseSeedDeck(rawSeed);

  const existing = await db.from("cards").select("kind, de, en").eq("user_id", userId).eq("source", "seed").limit(5000);
  if (existing.error) fail("Reading the deck", existing.error);
  const have = new Set((existing.data ?? []).map((c) => `${c.kind}\u0000${c.de}\u0000${c.en}`));
  const missing = cards.filter((c) => !have.has(`${c.kind}\u0000${c.de}\u0000${c.en}`));

  const plan = planImportSchedule(missing, { startSeq: seedStartSeq(), today: now });
  let seen = 0;
  for (let i = 0; i < plan.length; i += 100) {
    const batch = plan.slice(i, i + 100);
    const inserted = await db
      .from("cards")
      .insert(
        batch.map(({ card }, j) => ({
          user_id: userId,
          kind: card.kind,
          en: card.en,
          article: card.article,
          de: card.de,
          plural: card.plural,
          example: card.example,
          example_en: card.exampleEn,
          tip: card.tip,
          session_code: card.sessionCode,
          source: "seed",
          // Keeps the lesson order when new cards are introduced.
          created_at: new Date(now.getTime() + (i + j) * 1000 - plan.length * 1000).toISOString(),
        })),
      )
      .select("id, kind, de, en");
    if (inserted.error) fail("Importing cards", inserted.error);

    const idOf = new Map((inserted.data ?? []).map((r) => [`${r.kind}\u0000${r.de}\u0000${r.en}`, r.id as string]));
    const srsRows = batch.map(({ card, srs, seen: wasSeen }) => {
      if (wasSeen) seen++;
      return { card_id: idOf.get(`${card.kind}\u0000${card.de}\u0000${card.en}`)!, user_id: userId, ...srsToRow(srs) };
    });
    const withSrs = await db.from("card_srs").insert(srsRows);
    if (withSrs.error) fail("Scheduling cards", withSrs.error);
  }

  return {
    imported: missing.length,
    alreadyThere: cards.length - missing.length,
    duplicatesSkipped: duplicates.length,
    seen,
    fresh: missing.length - seen,
  };
}

/** For the Home screen: how many cards are waiting today (reviews due + new cards still allowed). */
export async function getDueCounts(db: SupabaseClient, userId: string, now: Date, timezone: string) {
  const endOfDay = startOfNextLocalDay(now, timezone).toISOString();
  const [due, fresh, started] = await Promise.all([
    db
      .from("card_srs")
      .select("card_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("last_reviewed_at", "is", null)
      .lt("due_at", endOfDay),
    db.from("card_srs").select("card_id", { count: "exact", head: true }).eq("user_id", userId).is("last_reviewed_at", null),
    db
      .from("reviews")
      .select("card_id")
      .eq("user_id", userId)
      .eq("was_new", true)
      .eq("applied", true)
      .gte("reviewed_at", startOfLocalDay(now, timezone).toISOString())
      .limit(1000),
  ]);
  if (due.error || fresh.error || started.error) return null;
  const startedToday = new Set((started.data ?? []).map((r) => r.card_id as string)).size;
  return { due: due.count ?? 0, fresh: Math.min(fresh.count ?? 0, Math.max(0, DAILY_NEW_LIMIT - startedToday)) };
}
