// Spaced repetition: one pure module shared by the browser (offline, instant) and the server (authoritative on sync).
// Deterministic on purpose: no fuzz, no clock reads. Callers pass the review time.

export const GRADES = ["again", "hard", "good", "easy"] as const;
export type Grade = (typeof GRADES)[number];

export interface SrsState {
  /** ISO timestamp. */
  dueAt: string;
  intervalDays: number;
  ease: number;
  /** Successful reviews in a row; 0 for new cards and cards in relearning. */
  reps: number;
  lapses: number;
  /** ISO timestamp, null for cards never reviewed. */
  lastReviewedAt: string | null;
}

export interface ReviewEvent {
  id: string;
  grade: Grade;
  /** ISO timestamp from the device that answered. */
  reviewedAt: string;
}

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const START_EASE = 2.5;
export const MAX_INTERVAL_DAYS = 365;
export const RELEARN_MINUTES = 10;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

const clampEase = (ease: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(ease * 100) / 100));

export function newSrsState(now: Date | string): SrsState {
  return {
    dueAt: new Date(now).toISOString(),
    intervalDays: 0,
    ease: START_EASE,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
  };
}

export const isNewCard = (s: SrsState) => s.reps === 0 && s.lastReviewedAt === null;

/** First step for a card with reps = 0 (new, or sent back to relearning after a lapse). */
const FIRST_STEP_DAYS: Record<Exclude<Grade, "again">, number> = { hard: 1, good: 2, easy: 4 };

/** The next state after answering with `grade` at `reviewedAt`. */
export function schedule(state: SrsState, grade: Grade, reviewedAt: Date | string): SrsState {
  const at = new Date(reviewedAt);
  const atMs = at.getTime();
  const lastReviewedAt = at.toISOString();
  const dueIn = (days: number) => new Date(atMs + days * DAY_MS).toISOString();

  if (state.reps === 0) {
    if (grade === "again") {
      return { ...state, dueAt: new Date(atMs + RELEARN_MINUTES * MINUTE_MS).toISOString(), lastReviewedAt };
    }
    const days = FIRST_STEP_DAYS[grade];
    const ease = grade === "hard" ? state.ease - 0.15 : grade === "easy" ? state.ease + 0.15 : state.ease;
    return { ...state, intervalDays: days, ease: clampEase(ease), reps: 1, dueAt: dueIn(days), lastReviewedAt };
  }

  if (grade === "again") {
    return {
      dueAt: new Date(atMs + RELEARN_MINUTES * MINUTE_MS).toISOString(),
      intervalDays: 1,
      ease: clampEase(state.ease - 0.2),
      reps: 0,
      lapses: state.lapses + 1,
      lastReviewedAt,
    };
  }

  const factor = grade === "hard" ? 1.2 : grade === "good" ? state.ease : state.ease * 1.3;
  const grown = Math.max(state.intervalDays + 1, Math.round(state.intervalDays * factor));
  const intervalDays = Math.min(MAX_INTERVAL_DAYS, grown);
  const ease = grade === "hard" ? state.ease - 0.15 : grade === "easy" ? state.ease + 0.15 : state.ease;
  return {
    ...state,
    intervalDays,
    ease: clampEase(ease),
    reps: state.reps + 1,
    dueAt: dueIn(intervalDays),
    lastReviewedAt,
  };
}

export interface FoldResult {
  state: SrsState;
  /** One entry per distinct event id, in the order they were considered (oldest first). */
  results: { id: string; applied: boolean; /** The card had never been reviewed before this event. */ wasNew: boolean }[];
}

/**
 * Applies a batch of (possibly offline, possibly out-of-order) review events to a card.
 * "Latest review wins": events are considered oldest first, and an event is applied only if it is newer than
 * the card's last applied review. An older event (another device synced later) is recorded as not applied.
 * Repeated event ids count once.
 */
export function foldReviews(state: SrsState, events: ReviewEvent[]): FoldResult {
  const seen = new Set<string>();
  const ordered = events
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.id.localeCompare(b.id));

  let current = state;
  const results: FoldResult["results"] = [];
  for (const event of ordered) {
    const last = current.lastReviewedAt === null ? -Infinity : Date.parse(current.lastReviewedAt);
    const applied = Date.parse(event.reviewedAt) > last;
    const wasNew = applied && current.lastReviewedAt === null;
    if (applied) current = schedule(current, event.grade, event.reviewedAt);
    results.push({ id: event.id, applied, wasNew });
  }
  return { state: current, results };
}

export interface IntervalPreview {
  unit: "minutes" | "days";
  value: number;
}

/** What each button will do, for the hint under it (e.g. "10 min", "2 days"). */
export function previewInterval(state: SrsState, grade: Grade, now: Date | string): IntervalPreview {
  const next = schedule(state, grade, now);
  const ms = Date.parse(next.dueAt) - new Date(now).getTime();
  if (ms < DAY_MS) return { unit: "minutes", value: Math.max(1, Math.round(ms / MINUTE_MS)) };
  return { unit: "days", value: Math.round(ms / DAY_MS) };
}
