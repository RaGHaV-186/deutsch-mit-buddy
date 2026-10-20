import { newSrsState, type SrsState } from "@/lib/srs";
import type { SnapshotCard } from "./schema";

let counter = 0;

type CardOverrides = Partial<Omit<SnapshotCard, "srs">> & { srs?: Partial<SrsState> };

/** A snapshot card for tests. IDs and creation times increase with each call. */
export function makeCard(over: CardOverrides = {}): SnapshotCard {
  counter += 1;
  const n = String(counter).padStart(12, "0");
  const { srs, ...rest } = over;
  return {
    id: `00000000-0000-4000-8000-${n}`,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, counter)).toISOString(),
    kind: "word",
    en: "dog",
    article: "der",
    de: "Hund",
    plural: "die Hunde",
    example: "Der Hund schläft.",
    exampleEn: "The dog is sleeping.",
    tip: null,
    sessionCode: "Z5",
    ...rest,
    srs: { ...newSrsState("2026-10-01T00:00:00Z"), ...srs },
  };
}

/** A card that was reviewed before and is due at `dueAt`. */
export const seenCard = (dueAt: string, over: Partial<Omit<SnapshotCard, "srs">> = {}) =>
  makeCard({ ...over, srs: { dueAt, reps: 1, intervalDays: 3, lastReviewedAt: "2026-10-15T10:00:00.000Z" } });
