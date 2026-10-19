import { describe, expect, it } from "vitest";
import { AGAIN_GAP, buildQueue, DAILY_NEW_LIMIT, isDueToday, matchesMode, requeue } from "./queue";
import { makeCard, seenCard } from "./test-helpers";

const NOW = new Date("2026-10-20T10:00:00Z"); // 12:00 in Berlin
const base = { mode: "both" as const, now: NOW, timezone: "Europe/Berlin", newToday: 0 };

describe("matchesMode", () => {
  it("Words = word cards, Speaking = say + answer, Both = all", () => {
    const w = makeCard({ kind: "word" });
    const s = makeCard({ kind: "say" });
    const a = makeCard({ kind: "answer" });
    expect([w, s, a].map((c) => matchesMode(c, "words"))).toEqual([true, false, false]);
    expect([w, s, a].map((c) => matchesMode(c, "speaking"))).toEqual([false, true, true]);
    expect([w, s, a].map((c) => matchesMode(c, "both"))).toEqual([true, true, true]);
  });
});

describe("isDueToday", () => {
  it("counts a card due this evening as today, but not one due after local midnight", () => {
    expect(isDueToday(seenCard("2026-10-20T21:59:00Z"), NOW, "Europe/Berlin")).toBe(true);
    expect(isDueToday(seenCard("2026-10-20T22:00:00Z"), NOW, "Europe/Berlin")).toBe(false);
  });

  it("follows the learner's timezone", () => {
    expect(isDueToday(seenCard("2026-10-20T22:00:00Z"), NOW, "Asia/Kolkata")).toBe(false);
    expect(isDueToday(seenCard("2026-10-20T18:00:00Z"), NOW, "Asia/Kolkata")).toBe(true);
  });
});

describe("buildQueue", () => {
  it("puts reviews first (oldest due first), then new cards in deck order", () => {
    const late = seenCard("2026-10-19T08:00:00Z");
    const early = seenCard("2026-10-17T08:00:00Z");
    const later = seenCard("2026-10-20T20:00:00Z");
    const tomorrow = seenCard("2026-10-21T08:00:00Z");
    const n1 = makeCard();
    const n2 = makeCard();
    const q = buildQueue([n2, tomorrow, later, n1, late, early], base);
    expect(q.cards.map((c) => c.id)).toEqual([early, late, later, n1, n2].map((c) => c.id));
    expect(q.counts).toEqual({ due: 3, fresh: 2, waiting: 0 });
  });

  it("introduces at most 20 new cards a day and counts what is already used up", () => {
    const fresh = Array.from({ length: 30 }, () => makeCard());
    expect(buildQueue(fresh, base).counts).toEqual({ due: 0, fresh: DAILY_NEW_LIMIT, waiting: 10 });
    expect(buildQueue(fresh, { ...base, newToday: 15 }).counts).toEqual({ due: 0, fresh: 5, waiting: 25 });
    expect(buildQueue(fresh, { ...base, newToday: 25 }).cards).toEqual([]);
  });

  it("always includes due reviews, even when the new-card allowance is used up", () => {
    const q = buildQueue([seenCard("2026-10-19T08:00:00Z"), makeCard()], { ...base, newToday: 20 });
    expect(q.counts).toEqual({ due: 1, fresh: 0, waiting: 1 });
  });

  it("treats a card sent to relearning (reviewed, due in minutes) as a review, not a new card", () => {
    const relearn = makeCard({ srs: { reps: 0, lastReviewedAt: "2026-10-20T09:55:00Z", dueAt: "2026-10-20T10:05:00Z" } });
    expect(buildQueue([relearn], base).counts).toEqual({ due: 1, fresh: 0, waiting: 0 });
  });

  it("filters by mode before counting", () => {
    const cards = [makeCard({ kind: "word" }), makeCard({ kind: "say" }), seenCard("2026-10-19T08:00:00Z", { kind: "answer" })];
    expect(buildQueue(cards, { ...base, mode: "words" }).counts).toEqual({ due: 0, fresh: 1, waiting: 0 });
    expect(buildQueue(cards, { ...base, mode: "speaking" }).counts).toEqual({ due: 1, fresh: 1, waiting: 0 });
    expect(buildQueue(cards, { ...base, mode: "both" }).cards).toHaveLength(3);
  });
});

describe("requeue", () => {
  it("inserts the card after AGAIN_GAP others, or at the end when fewer remain", () => {
    const rest = [1, 2, 3, 4, 5, 6, 7];
    expect(requeue(rest, 0)).toEqual([1, 2, 3, 4, 5, 0, 6, 7]);
    expect(AGAIN_GAP).toBe(5);
    expect(requeue([1, 2], 0)).toEqual([1, 2, 0]);
    expect(requeue([], 0)).toEqual([0]);
  });

  it("does not mutate the queue", () => {
    const rest = [1, 2, 3];
    requeue(rest, 0);
    expect(rest).toEqual([1, 2, 3]);
  });
});
