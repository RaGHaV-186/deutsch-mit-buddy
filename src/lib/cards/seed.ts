import { indexOfCode } from "@data/curriculum";
import { SEED_LOGS, SEED_PROFILE } from "@data/seed-tracker";
import { seedDeckSchema, type CardInput, type SeedCard } from "./schema";

export interface SeedImportCard extends CardInput {
  /** Lesson order in the curriculum, for planImportSchedule. */
  seq: number;
}

export interface ParsedSeed {
  cards: SeedImportCard[];
  /** Rows dropped because the same card (kind + German + English) appeared on an earlier day. */
  duplicates: SeedCard[];
}

/** Day number in the tracker -> curriculum code. Days 1-10 are logged; the next lesson (Day 11) is the tracker's next_code. */
export function codeForDay(day: number): string | undefined {
  const log = SEED_LOGS.find((l) => l.day === day);
  if (log) return log.code;
  return day === SEED_PROFILE.day_count + 1 ? SEED_PROFILE.next_code : undefined;
}

/** The lesson where Raghav continues (Z9); his cards from earlier lessons count as already seen. */
export const seedStartSeq = () => indexOfCode(SEED_PROFILE.next_code);

const dedupeKey = (c: SeedCard) => `${c.kind}\u0000${c.de}\u0000${c.en}`;

/** Validates data/seed-cards.json (throws on a bad row), drops repeats (keeping the earliest day) and attaches lesson codes. */
export function parseSeedDeck(raw: unknown): ParsedSeed {
  const rows = seedDeckSchema.parse(raw);
  const firstSeen = new Set<string>();
  const cards: SeedImportCard[] = [];
  const duplicates: SeedCard[] = [];

  for (const row of [...rows].sort((a, b) => a.day - b.day)) {
    const key = dedupeKey(row);
    if (firstSeen.has(key)) {
      duplicates.push(row);
      continue;
    }
    firstSeen.add(key);
    const sessionCode = codeForDay(row.day);
    const seq = sessionCode ? indexOfCode(sessionCode) : -1;
    if (!sessionCode || seq < 0) throw new Error(`Seed card for unknown day ${row.day}`);
    cards.push({
      kind: row.kind,
      en: row.en,
      article: row.art,
      de: row.de,
      plural: row.pl,
      example: row.ex,
      exampleEn: row.ex_en,
      tip: row.tip,
      sessionCode,
      seq,
    });
  }
  return { cards, duplicates };
}
