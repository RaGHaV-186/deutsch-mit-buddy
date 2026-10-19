import { SESSIONS, type Session } from "@data/curriculum";

export interface StartingPoint {
  /** Index into SESSIONS; the profile's `session_seq`. Codes like SAT repeat, so the index is the identity. */
  seq: number;
  code: string;
  grammar: string;
  theme: string;
  phase: Session["phase"];
}

/** Lessons a learner may start from (no weekends, reviews, tests or buffers). */
export const STARTING_POINTS: StartingPoint[] = SESSIONS.flatMap((s, seq) =>
  s.kind === "lesson" ? [{ seq, code: s.code, grammar: s.grammar, theme: s.theme, phase: s.phase }] : [],
);

export function findStartingPoint(seq: number): StartingPoint | undefined {
  return STARTING_POINTS.find((p) => p.seq === seq);
}

export const PHASE_ORDER: Session["phase"][] = ["zero", "A1", "A2", "B1", "exam"];

export function groupByPhase(points: StartingPoint[] = STARTING_POINTS) {
  return PHASE_ORDER.map((phase) => ({ phase, points: points.filter((p) => p.phase === phase) })).filter(
    (g) => g.points.length > 0,
  );
}
