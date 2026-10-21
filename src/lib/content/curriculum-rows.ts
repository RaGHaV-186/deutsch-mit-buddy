// Turns the authored plan (data/curriculum.ts) into rows for the curriculum_sessions table.
// Relative imports only: the seed script runs this file with plain Node (no path aliases).

export interface PlanSession {
  code: string;
  kind: "lesson" | "saturday" | "sunday" | "review" | "test" | "buffer";
  grammar: string;
  theme: string;
  goal?: string;
  phase: "zero" | "A1" | "A2" | "B1" | "exam" | "B2" | "C1";
}

export interface CurriculumRow {
  seq: number;
  code: string;
  kind: PlanSession["kind"];
  phase: PlanSession["phase"];
  grammar: string;
  theme: string;
  goal: string | null;
  word_target: number;
}

/** Words taught in every lesson: 12 core + 6 bonus (the lesson standard asks for 15 to 20). */
export const CORE_WORDS = 12;
export const BONUS_WORDS = 6;
export const WORDS_PER_LESSON = CORE_WORDS + BONUS_WORDS;

export function toCurriculumRows(sessions: readonly PlanSession[]): CurriculumRow[] {
  return sessions.map((s, seq) => ({
    seq,
    code: s.code,
    kind: s.kind,
    phase: s.phase,
    grammar: s.grammar,
    theme: s.theme,
    goal: s.goal ?? null,
    word_target: s.kind === "lesson" ? WORDS_PER_LESSON : 0,
  }));
}

/** Lesson sessions only, with the seq they have in the full plan. */
export function lessonsOf(sessions: readonly PlanSession[]) {
  return toCurriculumRows(sessions).filter((r) => r.kind === "lesson");
}

/** The CEFR level a phase is taught at (zero is the stretch before A1; exam preparation is B1). */
export function cefrOf(phase: PlanSession["phase"]): "A1" | "A2" | "B1" | "B2" | "C1" {
  switch (phase) {
    case "zero":
    case "A1":
      return "A1";
    case "A2":
      return "A2";
    case "B1":
    case "exam":
      return "B1";
    default:
      return phase;
  }
}
