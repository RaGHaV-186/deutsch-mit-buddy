import { describe, expect, it } from "vitest";
import {
  foldReviews,
  isNewCard,
  MAX_INTERVAL_DAYS,
  newSrsState,
  previewInterval,
  schedule,
  type ReviewEvent,
  type SrsState,
} from "./srs";

const T0 = new Date("2026-10-20T10:00:00Z");
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000).toISOString();
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000).toISOString();

const review = (over: Partial<SrsState> = {}): SrsState => ({
  dueAt: T0.toISOString(),
  intervalDays: 10,
  ease: 2.5,
  reps: 3,
  lapses: 0,
  lastReviewedAt: days(-10),
  ...over,
});

describe("schedule: new cards", () => {
  const fresh = newSrsState(T0);

  it("starts new, due now", () => {
    expect(isNewCard(fresh)).toBe(true);
    expect(fresh).toMatchObject({ reps: 0, intervalDays: 0, ease: 2.5, lapses: 0, lastReviewedAt: null });
  });

  it("Again keeps the card in learning and brings it back in 10 minutes", () => {
    const next = schedule(fresh, "again", T0);
    expect(next).toMatchObject({ reps: 0, dueAt: minutes(10), lapses: 0, ease: 2.5, lastReviewedAt: T0.toISOString() });
    expect(isNewCard(next)).toBe(false);
  });

  it.each([
    ["hard", 1, 2.35],
    ["good", 2, 2.5],
    ["easy", 4, 2.65],
  ] as const)("%s graduates to %i day(s)", (grade, interval, ease) => {
    expect(schedule(fresh, grade, T0)).toMatchObject({ reps: 1, intervalDays: interval, ease, dueAt: days(interval) });
  });
});

describe("schedule: review cards", () => {
  it("Again lapses: back to relearning, 1 day target, 10 minutes, ease down", () => {
    expect(schedule(review(), "again", T0)).toMatchObject({
      reps: 0,
      lapses: 1,
      intervalDays: 1,
      ease: 2.3,
      dueAt: minutes(10),
    });
  });

  it("Hard grows 20% (at least a day) and lowers ease", () => {
    expect(schedule(review(), "hard", T0)).toMatchObject({ intervalDays: 12, ease: 2.35, reps: 4, dueAt: days(12) });
    expect(schedule(review({ intervalDays: 1 }), "hard", T0).intervalDays).toBe(2);
  });

  it("Got it multiplies by ease; Easy by ease x 1.3 and raises ease", () => {
    expect(schedule(review(), "good", T0)).toMatchObject({ intervalDays: 25, ease: 2.5 });
    expect(schedule(review(), "easy", T0)).toMatchObject({ intervalDays: 33, ease: 2.65 });
  });

  it("always grows by at least one day", () => {
    expect(schedule(review({ intervalDays: 1, ease: 1.3 }), "good", T0).intervalDays).toBe(2);
  });

  it("caps the interval and keeps ease within 1.3 to 3.0", () => {
    expect(schedule(review({ intervalDays: 300 }), "easy", T0).intervalDays).toBe(MAX_INTERVAL_DAYS);
    expect(schedule(review({ ease: 1.35 }), "again", T0).ease).toBe(1.3);
    expect(schedule(review({ ease: 2.95 }), "easy", T0).ease).toBe(3);
  });

  it("a relearning card (reps 0 after a lapse) graduates like a new one and keeps its lapses", () => {
    const lapsed = schedule(review(), "again", T0);
    const next = schedule(lapsed, "good", new Date(minutes(11)));
    expect(next).toMatchObject({ reps: 1, intervalDays: 2, lapses: 1 });
  });

  it("is deterministic and does not mutate its input", () => {
    const input = review();
    const copy = structuredClone(input);
    expect(schedule(input, "good", T0)).toEqual(schedule(input, "good", T0));
    expect(input).toEqual(copy);
  });
});

describe("foldReviews: latest review wins", () => {
  const ev = (id: string, grade: ReviewEvent["grade"], reviewedAt: string): ReviewEvent => ({ id, grade, reviewedAt });

  it("applies events oldest first, whatever order they arrive in", () => {
    const a = ev("a", "good", minutes(1));
    const b = ev("b", "good", minutes(2));
    const forward = foldReviews(newSrsState(T0), [a, b]);
    const backward = foldReviews(newSrsState(T0), [b, a]);
    expect(backward.state).toEqual(forward.state);
    expect(forward.state.reps).toBe(2);
    expect(forward.results).toEqual([
      { id: "a", applied: true },
      { id: "b", applied: true },
    ]);
  });

  it("records an event older than the last applied review without changing the schedule", () => {
    const afterOther = schedule(newSrsState(T0), "easy", minutes(30));
    const { state, results } = foldReviews(afterOther, [ev("late", "again", minutes(10))]);
    expect(state).toEqual(afterOther);
    expect(results).toEqual([{ id: "late", applied: false }]);
  });

  it("counts a repeated event id once", () => {
    const e = ev("same", "good", minutes(1));
    const { state, results } = foldReviews(newSrsState(T0), [e, e]);
    expect(results).toHaveLength(1);
    expect(state.reps).toBe(1);
  });

  it("does not apply an event at exactly the last review time twice", () => {
    const once = schedule(newSrsState(T0), "good", minutes(5));
    expect(foldReviews(once, [ev("x", "good", minutes(5))]).results).toEqual([{ id: "x", applied: false }]);
  });

  it("is unchanged by an empty batch", () => {
    const s = review();
    expect(foldReviews(s, [])).toEqual({ state: s, results: [] });
  });
});

describe("previewInterval", () => {
  it("shows minutes for the relearn step and days otherwise", () => {
    const s = newSrsState(T0);
    expect(previewInterval(s, "again", T0)).toEqual({ unit: "minutes", value: 10 });
    expect(previewInterval(s, "good", T0)).toEqual({ unit: "days", value: 2 });
    expect(previewInterval(review(), "easy", T0)).toEqual({ unit: "days", value: 33 });
  });
});
