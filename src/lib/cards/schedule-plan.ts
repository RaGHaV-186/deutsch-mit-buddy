import { newSrsState, START_EASE, type SrsState } from "@/lib/srs";

const DAY_MS = 86_400_000;

export interface PlanOptions {
  /** Lesson order (index into the curriculum) where the learner starts. Cards before it count as already seen. */
  startSeq: number;
  /** Import time; bucket 0 is due now. */
  today: Date;
  /** Days over which the already-seen cards are spread. */
  buckets?: number;
  /** Interval given to already-seen cards. */
  seenIntervalDays?: number;
}

export interface PlannedCard<T> {
  card: T;
  seen: boolean;
  srs: SrsState;
}

/**
 * Decides the starting schedule for a batch of cards given to a learner at once. Not tied to any data source:
 * Raghav's seed import uses it now, and the curriculum slice will use it unchanged for every learner who picks
 * a later starting point (earlier lessons' cards = already seen and spread over days, the starting lesson's cards = new).
 *
 * - `card.seq < startSeq`: already seen. reps 1, a short interval, dealt round-robin into `buckets` daily groups
 *   (newest lessons first), so the first days stay a manageable size instead of one huge pile.
 * - otherwise: new, due now (the queue introduces them at the daily new-card limit).
 *
 * Returns one entry per input card, in the input order.
 */
export function planImportSchedule<T extends { seq: number }>(cards: T[], options: PlanOptions): PlannedCard<T>[] {
  const buckets = Math.max(1, Math.floor(options.buckets ?? 6));
  const seenIntervalDays = options.seenIntervalDays ?? 3;
  const todayMs = options.today.getTime();
  const lastReviewedAt = new Date(todayMs - DAY_MS).toISOString();

  const seenOrder = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.seq < options.startSeq)
    .sort((a, b) => b.card.seq - a.card.seq || a.index - b.index);
  const bucketOf = new Map<number, number>();
  seenOrder.forEach(({ index }, i) => bucketOf.set(index, i % buckets));

  return cards.map((card, index) => {
    const bucket = bucketOf.get(index);
    if (bucket === undefined) return { card, seen: false, srs: newSrsState(options.today) };
    return {
      card,
      seen: true,
      srs: {
        dueAt: new Date(todayMs + bucket * DAY_MS).toISOString(),
        intervalDays: seenIntervalDays,
        ease: START_EASE,
        reps: 1,
        lapses: 0,
        lastReviewedAt,
      },
    };
  });
}
