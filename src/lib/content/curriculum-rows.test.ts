import { SESSIONS } from "@data/curriculum";
import { describe, expect, it } from "vitest";
import { PHASE_ORDER, groupByPhase } from "@/lib/curriculum/starting-points";
import { cefrOf, lessonsOf, toCurriculumRows, WORDS_PER_LESSON } from "./curriculum-rows";

describe("curriculum rows (data/curriculum.ts -> curriculum_sessions)", () => {
  const rows = toCurriculumRows(SESSIONS);

  it("one row per session, with the position in the plan as seq", () => {
    expect(rows).toHaveLength(SESSIONS.length);
    expect(rows.map((r) => r.seq)).toEqual(SESSIONS.map((_, i) => i));
  });

  it("covers Z1 to B1 only: 90 lessons, 131 sessions, no B2 or C1 yet", () => {
    expect(SESSIONS).toHaveLength(131);
    expect(lessonsOf(SESSIONS)).toHaveLength(90);
    expect(rows.some((r) => r.phase === "B2" || r.phase === "C1")).toBe(false);
  });

  it("lesson codes are unique (cards and questions refer to them); weekend codes repeat", () => {
    const lessonCodes = lessonsOf(SESSIONS).map((r) => r.code);
    expect(new Set(lessonCodes).size).toBe(lessonCodes.length);
    expect(rows.filter((r) => r.code === "SAT").length).toBeGreaterThan(1);
  });

  it("only lessons teach words: 10 core + 5 bonus", () => {
    for (const r of rows) expect(r.word_target).toBe(r.kind === "lesson" ? WORDS_PER_LESSON : 0);
    expect(WORDS_PER_LESSON).toBe(15);
  });

  it("every row fits the table's column rules", () => {
    for (const r of rows) {
      expect(r.code.length).toBeGreaterThan(0);
      expect(r.code.length).toBeLessThanOrEqual(12);
      expect(r.grammar.length).toBeLessThanOrEqual(400);
      expect(r.theme.length).toBeLessThanOrEqual(400);
      expect(r.goal === null || r.goal.length <= 400).toBe(true);
    }
  });

  it("phases map to CEFR levels (exam preparation is B1)", () => {
    expect([cefrOf("zero"), cefrOf("A1"), cefrOf("A2"), cefrOf("B1"), cefrOf("exam"), cefrOf("B2"), cefrOf("C1")]).toEqual(["A1", "A1", "A2", "B1", "B1", "B2", "C1"]);
  });
});

describe("the starting-lesson picker is ready for B2 and C1", () => {
  it("lists B2 and C1 after the exam phase, and shows only phases that have lessons", () => {
    expect(PHASE_ORDER.slice(-2)).toEqual(["B2", "C1"]);
    expect(groupByPhase().map((g) => g.phase)).toEqual(["zero", "A1", "A2", "B1", "exam"]);
  });
});
