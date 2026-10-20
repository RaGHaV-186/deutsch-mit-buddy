import rawSeed from "@data/seed-cards.json";
import { indexOfCode } from "@data/curriculum";
import { describe, expect, it } from "vitest";
import { cardInputSchema } from "./schema";
import { planImportSchedule } from "./schedule-plan";
import { codeForDay, parseSeedDeck, seedStartSeq } from "./seed";

const T0 = new Date("2026-10-20T10:00:00Z");
const DAY = 86_400_000;

describe("parseSeedDeck (the real data/seed-cards.json)", () => {
  const { cards, duplicates } = parseSeedDeck(rawSeed);

  it("accepts every one of the 213 rows and drops only repeated cards", () => {
    expect(cards.length + duplicates.length).toBe(213);
    expect(duplicates.length).toBe(11);
    const keys = cards.map((c) => `${c.kind}|${c.de}|${c.en}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps the earliest day of a repeated card", () => {
    const wochenende = cards.filter((c) => c.de === "Wochenende");
    expect(wochenende).toHaveLength(1);
    const dayOfDuplicate = duplicates.find((d) => d.de === "Wochenende")!.day;
    const firstDay = codeForDay(dayOfDuplicate)!;
    expect(indexOfCode(wochenende[0].sessionCode!)).toBeLessThan(indexOfCode(firstDay));
  });

  it("produces cards that satisfy the shared card schema", () => {
    for (const card of cards) expect(() => cardInputSchema.parse(card)).not.toThrow();
  });

  it("maps tracker days to lesson codes", () => {
    expect([2, 7, 8, 9, 11].map(codeForDay)).toEqual(["Z2", "R1", "T1", "Z7", "Z9"]);
    expect(codeForDay(50)).toBeUndefined();
  });

  it("rejects bad rows instead of importing them", () => {
    expect(() => parseSeedDeck([{ day: 2, kind: "poem" }])).toThrow();
    expect(() => parseSeedDeck([{ day: 99, kind: "word", en: "x", art: null, de: "y", pl: null, ex: null, ex_en: null, tip: null }])).toThrow(
      /unknown day/,
    );
  });
});

describe("planImportSchedule with Raghav's deck", () => {
  const { cards } = parseSeedDeck(rawSeed);
  const plan = planImportSchedule(cards, { startSeq: seedStartSeq(), today: T0 });

  it("treats Day 11 (Z9) cards as new and everything earlier as seen", () => {
    for (const p of plan) {
      expect(p.seen).toBe(p.card.sessionCode !== "Z9");
      if (!p.seen) expect(p.srs).toMatchObject({ reps: 0, lastReviewedAt: null, dueAt: T0.toISOString() });
    }
    expect(plan.filter((p) => !p.seen).length).toBeGreaterThan(0);
  });

  it("spreads the seen cards over 6 days with no pile-up", () => {
    const perDay = new Map<number, number>();
    for (const p of plan.filter((x) => x.seen)) {
      const day = Math.round((Date.parse(p.srs.dueAt) - T0.getTime()) / DAY);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    expect([...perDay.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    const counts = [...perDay.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(Math.max(...counts)).toBeLessThanOrEqual(40);
  });
});

describe("planImportSchedule is generic (reused by the curriculum slice)", () => {
  const lessons = Array.from({ length: 30 }, (_, seq) => Array.from({ length: 4 }, (_, i) => ({ seq, id: `${seq}-${i}` }))).flat();

  it("a later starting point: earlier lessons seen and spread, the starting lesson and later ones new", () => {
    const plan = planImportSchedule(lessons, { startSeq: 20, today: T0, buckets: 5, seenIntervalDays: 4 });
    expect(plan).toHaveLength(lessons.length);
    expect(plan.map((p) => p.card.id)).toEqual(lessons.map((l) => l.id)); // input order kept
    const seen = plan.filter((p) => p.seen);
    expect(seen).toHaveLength(80);
    expect(seen.every((p) => p.card.seq < 20 && p.srs.reps === 1 && p.srs.intervalDays === 4)).toBe(true);
    expect(plan.filter((p) => !p.seen).every((p) => p.card.seq >= 20 && p.srs.reps === 0)).toBe(true);
    const buckets = new Set(seen.map((p) => Date.parse(p.srs.dueAt)));
    expect(buckets.size).toBe(5);
  });

  it("starting at the very first lesson gives all-new cards; no cards gives nothing", () => {
    expect(planImportSchedule(lessons, { startSeq: 0, today: T0 }).every((p) => !p.seen)).toBe(true);
    expect(planImportSchedule([], { startSeq: 5, today: T0 })).toEqual([]);
  });

  it("deals newest lessons first, so each day's pile has the same mix", () => {
    const plan = planImportSchedule(lessons, { startSeq: 20, today: T0, buckets: 4 });
    const first = plan.filter((p) => p.seen && Date.parse(p.srs.dueAt) === T0.getTime());
    const newest = Math.max(...plan.filter((p) => p.seen).map((p) => p.card.seq));
    expect(first.some((p) => p.card.seq === newest)).toBe(true);
  });
});
