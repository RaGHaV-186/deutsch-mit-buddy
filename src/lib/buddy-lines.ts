import type { Session } from "@data/curriculum";

export type HomeLineKey = "theme" | "letsGo" | "stepByStep" | "youCanDoIt" | "wuff" | "review" | "test" | "catchUp";

const LESSON_POOL: HomeLineKey[] = ["theme", "letsGo", "stepByStep", "youCanDoIt", "wuff"];

/**
 * Buddy's German line on Home (message key under "Buddy.home"). Tied to today's session: lessons rotate through a few
 * lines, one of which names the lesson's theme; weekends, tests and buffer days have their own. Same line all day.
 */
export function homeLine(session: Session | undefined, dayCount: number): { key: HomeLineKey; theme?: string } {
  if (!session) return { key: "letsGo" };
  switch (session.kind) {
    case "saturday":
    case "review":
      return { key: "review" };
    case "sunday":
    case "test":
      return { key: "test" };
    case "buffer":
      return { key: "catchUp" };
    default: {
      const key = LESSON_POOL[Math.abs(dayCount) % LESSON_POOL.length];
      const hasTheme = session.theme && session.theme !== "—";
      if (key === "theme") return hasTheme ? { key, theme: session.theme } : { key: "letsGo" };
      return { key };
    }
  }
}

/** The title under "DAY 11 · Z9": the lesson's theme, or its grammar point when it has no theme (exam lessons). */
export const lessonTitle = (session: Session) => (session.theme && session.theme !== "—" ? session.theme : session.grammar);
