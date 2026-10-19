import { isNewCard } from "@/lib/srs";
import { startOfNextLocalDay } from "@/lib/time";
import type { SnapshotCard } from "./schema";

export type Mode = "words" | "speaking" | "both";
export type Direction = "en-de" | "de-en";

export const MODES: Mode[] = ["words", "speaking", "both"];
export const DIRECTIONS: Direction[] = ["en-de", "de-en"];
export const DAILY_NEW_LIMIT = 20;
/** An "Again" card comes back after this many other cards. */
export const AGAIN_GAP = 5;

export function matchesMode(card: Pick<SnapshotCard, "kind">, mode: Mode): boolean {
  if (mode === "both") return true;
  return mode === "words" ? card.kind === "word" : card.kind !== "word";
}

/** Due today: scheduled before the end of the learner's local day (a card due this evening is part of today). */
export function isDueToday(card: Pick<SnapshotCard, "srs">, now: Date, tz: string): boolean {
  return Date.parse(card.srs.dueAt) < startOfNextLocalDay(now, tz).getTime();
}

export interface QueueOptions {
  mode: Mode;
  now: Date;
  timezone: string;
  /** Cards already first-reviewed today; they use up the daily new-card allowance. */
  newToday: number;
  newLimit?: number;
}

export interface QueueCounts {
  /** Cards that were reviewed before and are due today. */
  due: number;
  /** New cards that will be introduced today (after the daily limit). */
  fresh: number;
  /** New cards still waiting beyond today's limit. */
  waiting: number;
}

export interface Queue {
  cards: SnapshotCard[];
  counts: QueueCounts;
}

const byCreated = (a: SnapshotCard, b: SnapshotCard) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Today's session: reviews due first (oldest due first), then new cards up to the daily limit, in deck order. */
export function buildQueue(all: SnapshotCard[], options: QueueOptions): Queue {
  const limit = options.newLimit ?? DAILY_NEW_LIMIT;
  const inMode = all.filter((c) => matchesMode(c, options.mode));

  const due = inMode
    .filter((c) => !isNewCard(c.srs) && isDueToday(c, options.now, options.timezone))
    .sort((a, b) => Date.parse(a.srs.dueAt) - Date.parse(b.srs.dueAt) || byCreated(a, b));

  const allNew = inMode.filter((c) => isNewCard(c.srs)).sort(byCreated);
  const allowance = Math.max(0, limit - options.newToday);
  const fresh = allNew.slice(0, allowance);

  return {
    cards: [...due, ...fresh],
    counts: { due: due.length, fresh: fresh.length, waiting: allNew.length - fresh.length },
  };
}

/** Puts a card back into the remaining queue after `gap` other cards (or at the end if fewer are left). */
export function requeue<T>(rest: T[], card: T, gap = AGAIN_GAP): T[] {
  const at = Math.min(gap, rest.length);
  return [...rest.slice(0, at), card, ...rest.slice(at)];
}
